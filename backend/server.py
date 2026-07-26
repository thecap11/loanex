from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'loanex-secret-change-in-prod-2026')
JWT_ALGO = 'HS256'
JWT_EXPIRE_MIN = 60 * 24 * 7

app = FastAPI()
api = APIRouter(prefix='/api')

# ---------- Models ----------
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    role: str = 'customer'

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ProductIn(BaseModel):
    name: str
    brand: str
    category: str
    price: float
    mrp: Optional[float] = None
    description: str
    image: str
    images: Optional[List[str]] = None
    stock: int = 0
    emi_eligible: bool = True
    specifications: Optional[Dict[str, str]] = None
    tags: Optional[List[str]] = None

class CartItemIn(BaseModel):
    product_id: str
    qty: int = 1

class OrderIn(BaseModel):
    items: List[CartItemIn]
    address_id: Optional[str] = None
    address_text: Optional[str] = None

class KycIn(BaseModel):
    aadhar: str
    pan: str
    housing_type: str  # owned | rented | with_parents
    monthly_income: float
    employer: Optional[str] = None

class AddressIn(BaseModel):
    label: str  # Home | Work | Other
    full_name: str
    phone: str
    line1: str
    line2: Optional[str] = None
    landmark: Optional[str] = None
    city: str
    state: str
    pincode: str
    is_default: bool = False

class EMIApplyIn(BaseModel):
    product_id: str
    qty: int = 1
    tenure_months: int
    address_id: str

class EMISanctionIn(BaseModel):
    notes: str = ''
    interest_rate: Optional[float] = None  # override if needed

class EMIRejectIn(BaseModel):
    reason: str

class ReviewIn(BaseModel):
    rating: int
    comment: str

class EMIConfigIn(BaseModel):
    interest_rate: float
    threshold: float
    tenures: List[int]
    down_payment_percent: float
    processing_fee: float

# ---------- Helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try: return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception: return False

def create_token(user_id: str, role: str) -> str:
    payload = {'sub': user_id, 'role': role, 'exp': datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MIN)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Not authenticated')
    token = authorization.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, 'Invalid token')
    user = await db.users.find_one({'id': payload['sub']}, {'_id': 0, 'password': 0})
    if not user: raise HTTPException(401, 'User not found')
    return user

def require_role(*roles):
    async def checker(user=Depends(get_current_user)):
        if user['role'] not in roles: raise HTTPException(403, 'Insufficient permissions')
        return user
    return checker

def now_iso() -> str: return datetime.now(timezone.utc).isoformat()

async def get_emi_config():
    cfg = await db.config.find_one({'_id': 'emi'}, {'_id': 0})
    if not cfg:
        cfg = {'interest_rate': 12.0, 'threshold': 5000.0, 'tenures': [3, 6, 12, 24], 'down_payment_percent': 20.0, 'processing_fee': 500.0}
    return cfg

def calc_emi(principal: float, months: int, annual_rate: float):
    r = annual_rate / 12 / 100
    if r == 0: monthly = principal / months
    else: monthly = principal * r * ((1 + r) ** months) / (((1 + r) ** months) - 1)
    total = monthly * months
    return round(monthly, 2), round(total, 2)

def user_out(u: dict) -> dict:
    return {k: u.get(k) for k in ['id', 'email', 'name', 'phone', 'role', 'kyc_status', 'credit_score', 'approved_limit', 'available_limit', 'used_limit', 'created_at']}

# ---------- Auth ----------
@api.post('/auth/register')
async def register(body: UserRegister):
    if body.role not in ('customer', 'admin', 'inventory_manager'):
        raise HTTPException(400, 'Invalid role')
    if await db.users.find_one({'email': body.email}):
        raise HTTPException(400, 'Email already registered')
    user = {
        'id': str(uuid.uuid4()),
        'email': body.email, 'name': body.name, 'phone': body.phone,
        'role': body.role, 'password': hash_pw(body.password),
        'created_at': now_iso(),
        'kyc_status': 'not_submitted',
        'credit_score': 650,  # starting score
        'approved_limit': 50000.0,
        'available_limit': 50000.0,
        'used_limit': 0.0,
    }
    await db.users.insert_one(user.copy())
    token = create_token(user['id'], user['role'])
    return {'token': token, 'user': user_out(user)}

@api.post('/auth/login')
async def login(body: UserLogin):
    user = await db.users.find_one({'email': body.email})
    if not user or not verify_pw(body.password, user['password']):
        raise HTTPException(401, 'Invalid email or password')
    token = create_token(user['id'], user['role'])
    return {'token': token, 'user': user_out(user)}

@api.get('/auth/me')
async def me(user=Depends(get_current_user)):
    return user_out(user)

# ---------- KYC ----------
@api.post('/kyc/submit')
async def submit_kyc(body: KycIn, user=Depends(get_current_user)):
    kyc = body.dict()
    kyc['status'] = 'verified'  # auto-verify in mock env
    kyc['submitted_at'] = now_iso()
    # bump credit score based on income
    new_score = min(900, 650 + int(body.monthly_income // 10000) * 20)
    new_limit = max(50000.0, min(500000.0, body.monthly_income * 6))
    await db.users.update_one({'id': user['id']}, {'$set': {
        'kyc': kyc, 'kyc_status': 'verified',
        'credit_score': new_score,
        'approved_limit': new_limit,
        'available_limit': new_limit - user.get('used_limit', 0),
    }})
    return {'ok': True, 'kyc_status': 'verified', 'credit_score': new_score, 'approved_limit': new_limit}

@api.get('/kyc/me')
async def get_kyc(user=Depends(get_current_user)):
    return user.get('kyc') or {'status': user.get('kyc_status', 'not_submitted')}

# ---------- Credit profile ----------
@api.get('/credit/profile')
async def credit_profile(user=Depends(get_current_user)):
    score = user.get('credit_score', 500)
    approved = user.get('approved_limit', 0)
    used = user.get('used_limit', 0)
    available = user.get('available_limit', 0)
    utilization = (used / approved * 100) if approved > 0 else 0
    # simple factor breakdown
    active_emis = await db.emi_applications.count_documents({'user_id': user['id'], 'status': 'active'})
    completed = await db.emi_applications.count_documents({'user_id': user['id'], 'status': 'completed'})
    rejected = await db.emi_applications.count_documents({'user_id': user['id'], 'status': 'rejected'})
    factors = [
        {'name': 'Payment History', 'impact': 'High', 'status': 'good' if completed > 0 or active_emis == 0 else 'ok'},
        {'name': 'Credit Utilization', 'impact': 'Medium', 'status': 'good' if utilization < 30 else 'warn' if utilization < 60 else 'bad', 'value': f'{utilization:.0f}%'},
        {'name': 'KYC Verified', 'impact': 'Medium', 'status': 'good' if user.get('kyc_status') == 'verified' else 'warn'},
        {'name': 'Recent Rejections', 'impact': 'Low', 'status': 'good' if rejected == 0 else 'warn', 'value': str(rejected)},
    ]
    tier = 'poor' if score < 500 else 'fair' if score < 651 else 'good' if score < 751 else 'excellent'
    return {
        'credit_score': score, 'tier': tier,
        'approved_limit': approved, 'available_limit': available, 'used_limit': used,
        'utilization': round(utilization, 1),
        'active_emis': active_emis, 'completed_emis': completed,
        'factors': factors,
    }

# ---------- Addresses ----------
@api.get('/addresses')
async def list_addr(user=Depends(get_current_user)):
    return await db.addresses.find({'user_id': user['id']}, {'_id': 0}).to_list(50)

@api.post('/addresses')
async def add_addr(body: AddressIn, user=Depends(get_current_user)):
    a = body.dict()
    a['id'] = str(uuid.uuid4()); a['user_id'] = user['id']; a['created_at'] = now_iso()
    if a['is_default']:
        await db.addresses.update_many({'user_id': user['id']}, {'$set': {'is_default': False}})
    await db.addresses.insert_one(a.copy())
    a.pop('_id', None)
    return a

@api.delete('/addresses/{aid}')
async def del_addr(aid: str, user=Depends(get_current_user)):
    await db.addresses.delete_one({'id': aid, 'user_id': user['id']})
    return {'ok': True}

# ---------- Products ----------
@api.get('/products')
async def list_products(category: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if category and category != 'All': query['category'] = category
    if q: query['name'] = {'$regex': q, '$options': 'i'}
    return await db.products.find(query, {'_id': 0}).to_list(200)

@api.get('/products/{pid}')
async def get_product(pid: str):
    p = await db.products.find_one({'id': pid}, {'_id': 0})
    if not p: raise HTTPException(404, 'Product not found')
    return p

@api.post('/products')
async def create_product(body: ProductIn, user=Depends(require_role('admin', 'inventory_manager'))):
    p = body.dict(); p['id'] = str(uuid.uuid4()); p['created_at'] = now_iso()
    p['rating'] = 0.0; p['review_count'] = 0
    await db.products.insert_one(p.copy()); p.pop('_id', None)
    return p

@api.put('/products/{pid}')
async def update_product(pid: str, body: ProductIn, user=Depends(require_role('admin', 'inventory_manager'))):
    res = await db.products.update_one({'id': pid}, {'$set': body.dict()})
    if res.matched_count == 0: raise HTTPException(404, 'Not found')
    return await db.products.find_one({'id': pid}, {'_id': 0})

@api.delete('/products/{pid}')
async def delete_product(pid: str, user=Depends(require_role('admin'))):
    await db.products.delete_one({'id': pid})
    return {'ok': True}

@api.post('/products/{pid}/restock')
async def restock(pid: str, body: dict, user=Depends(require_role('admin', 'inventory_manager'))):
    qty = int(body.get('quantity', 0))
    if qty <= 0: raise HTTPException(400, 'Quantity must be positive')
    res = await db.products.update_one({'id': pid}, {'$inc': {'stock': qty}})
    if res.matched_count == 0: raise HTTPException(404, 'Not found')
    return await db.products.find_one({'id': pid}, {'_id': 0})

@api.get('/categories')
async def categories():
    return ['All', 'Mobiles', 'Laptops', 'TVs', 'Audio', 'Gaming', 'Wearables', 'Appliances']

# ---------- Reviews ----------
@api.post('/products/{pid}/reviews')
async def add_review(pid: str, body: ReviewIn, user=Depends(get_current_user)):
    if not 1 <= body.rating <= 5: raise HTTPException(400, 'Rating must be 1-5')
    r = {'id': str(uuid.uuid4()), 'product_id': pid, 'user_id': user['id'], 'user_name': user['name'],
         'rating': body.rating, 'comment': body.comment, 'created_at': now_iso()}
    await db.reviews.insert_one(r.copy()); r.pop('_id', None)
    # recompute product rating
    all_r = await db.reviews.find({'product_id': pid}, {'_id': 0, 'rating': 1}).to_list(1000)
    avg = sum(x['rating'] for x in all_r) / len(all_r)
    await db.products.update_one({'id': pid}, {'$set': {'rating': round(avg, 1), 'review_count': len(all_r)}})
    return r

@api.get('/products/{pid}/reviews')
async def list_reviews(pid: str):
    return await db.reviews.find({'product_id': pid}, {'_id': 0}).sort('created_at', -1).to_list(200)

# ---------- EMI Config & Calculator ----------
@api.get('/emi/config')
async def emi_config():
    return await get_emi_config()

@api.put('/emi/config')
async def update_emi_config(body: EMIConfigIn, user=Depends(require_role('admin'))):
    await db.config.update_one({'_id': 'emi'}, {'$set': body.dict()}, upsert=True)
    return body.dict()

@api.get('/emi/calculate')
async def emi_calc(price: float, tenure: int):
    cfg = await get_emi_config()
    dp = price * cfg['down_payment_percent'] / 100
    principal = price - dp
    monthly, total = calc_emi(principal, tenure, cfg['interest_rate'])
    total_payable = dp + total + cfg['processing_fee']
    return {
        'price': price, 'tenure': tenure, 'interest_rate': cfg['interest_rate'],
        'down_payment': round(dp, 2), 'principal': round(principal, 2),
        'monthly': monthly, 'total_interest': round(total - principal, 2),
        'processing_fee': cfg['processing_fee'], 'total_payable': round(total_payable, 2),
        'eligible': price >= cfg['threshold'], 'threshold': cfg['threshold'],
    }

# ---------- Cart ----------
@api.get('/cart')
async def get_cart(user=Depends(get_current_user)):
    cart = await db.carts.find_one({'user_id': user['id']}, {'_id': 0}) or {'items': []}
    result = []
    for it in cart.get('items', []):
        p = await db.products.find_one({'id': it['product_id']}, {'_id': 0})
        if p: result.append({'product': p, 'qty': it['qty']})
    return {'items': result}

@api.post('/cart/add')
async def add_to_cart(body: CartItemIn, user=Depends(get_current_user)):
    cart = await db.carts.find_one({'user_id': user['id']}) or {'user_id': user['id'], 'items': []}
    items = cart.get('items', [])
    found = False
    for it in items:
        if it['product_id'] == body.product_id:
            it['qty'] += body.qty; found = True
    if not found: items.append({'product_id': body.product_id, 'qty': body.qty})
    await db.carts.update_one({'user_id': user['id']}, {'$set': {'items': items}}, upsert=True)
    return {'ok': True}

@api.post('/cart/remove')
async def remove_from_cart(body: CartItemIn, user=Depends(get_current_user)):
    cart = await db.carts.find_one({'user_id': user['id']}) or {'items': []}
    items = [it for it in cart.get('items', []) if it['product_id'] != body.product_id]
    await db.carts.update_one({'user_id': user['id']}, {'$set': {'items': items}}, upsert=True)
    return {'ok': True}

@api.post('/cart/clear')
async def clear_cart(user=Depends(get_current_user)):
    await db.carts.update_one({'user_id': user['id']}, {'$set': {'items': []}}, upsert=True)
    return {'ok': True}

# ---------- Direct Orders (full payment) ----------
@api.post('/orders')
async def create_order(body: OrderIn, user=Depends(get_current_user)):
    if not body.items: raise HTTPException(400, 'No items')
    order_items = []; total = 0.0
    for it in body.items:
        p = await db.products.find_one({'id': it.product_id}, {'_id': 0})
        if not p: raise HTTPException(400, f'Product {it.product_id} not found')
        if p['stock'] < it.qty: raise HTTPException(400, f'Insufficient stock for {p["name"]}')
        order_items.append({'product_id': p['id'], 'name': p['name'], 'image': p['image'], 'price': p['price'], 'qty': it.qty})
        total += p['price'] * it.qty

    address = body.address_text
    if body.address_id:
        addr = await db.addresses.find_one({'id': body.address_id}, {'_id': 0})
        if addr: address = f"{addr['full_name']}, {addr['line1']}, {addr.get('line2', '')}, {addr['city']}, {addr['state']} - {addr['pincode']}"

    order = {
        'id': str(uuid.uuid4()), 'user_id': user['id'], 'user_name': user['name'], 'user_email': user['email'],
        'items': order_items, 'address': address, 'subtotal': round(total, 2),
        'payment_method': 'full', 'status': 'confirmed', 'created_at': now_iso(),
    }
    await db.orders.insert_one(order.copy())
    for it in body.items:
        await db.products.update_one({'id': it.product_id}, {'$inc': {'stock': -it.qty}})
    await db.carts.update_one({'user_id': user['id']}, {'$set': {'items': []}}, upsert=True)
    order.pop('_id', None)
    return order

@api.get('/orders')
async def my_orders(user=Depends(get_current_user)):
    return await db.orders.find({'user_id': user['id']}, {'_id': 0}).sort('created_at', -1).to_list(200)

@api.get('/orders/{oid}')
async def get_order(oid: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({'id': oid}, {'_id': 0})
    if not o: raise HTTPException(404, 'Not found')
    if user['role'] == 'customer' and o['user_id'] != user['id']: raise HTTPException(403)
    return o

# ---------- EMI Applications ----------
@api.post('/emi/apply')
async def apply_emi(body: EMIApplyIn, user=Depends(get_current_user)):
    if user.get('kyc_status') != 'verified':
        raise HTTPException(400, 'KYC verification required')
    p = await db.products.find_one({'id': body.product_id}, {'_id': 0})
    if not p: raise HTTPException(404, 'Product not found')
    if p['stock'] < body.qty: raise HTTPException(400, 'Insufficient stock')
    if not p.get('emi_eligible', True): raise HTTPException(400, 'EMI not available for this product')
    cfg = await get_emi_config()
    if body.tenure_months not in cfg['tenures']: raise HTTPException(400, 'Invalid tenure')
    total_price = p['price'] * body.qty
    if total_price < cfg['threshold']: raise HTTPException(400, f'Order below EMI threshold ₹{cfg["threshold"]}')
    if total_price > user.get('available_limit', 0): raise HTTPException(400, f'Insufficient credit limit. Available: ₹{user.get("available_limit", 0)}')

    dp = total_price * cfg['down_payment_percent'] / 100
    principal = total_price - dp
    monthly, total_int_pay = calc_emi(principal, body.tenure_months, cfg['interest_rate'])

    addr = await db.addresses.find_one({'id': body.address_id, 'user_id': user['id']}, {'_id': 0})
    if not addr: raise HTTPException(400, 'Address not found')

    app_doc = {
        'id': str(uuid.uuid4()), 'user_id': user['id'], 'user_name': user['name'], 'user_email': user['email'],
        'user_score': user.get('credit_score', 500),
        'product': {'id': p['id'], 'name': p['name'], 'image': p['image'], 'brand': p['brand']},
        'qty': body.qty, 'total_price': round(total_price, 2),
        'tenure_months': body.tenure_months,
        'down_payment': round(dp, 2), 'principal': round(principal, 2),
        'interest_rate': cfg['interest_rate'],
        'monthly_emi': monthly, 'total_interest': round(total_int_pay - principal, 2),
        'processing_fee': cfg['processing_fee'],
        'total_payable': round(dp + total_int_pay + cfg['processing_fee'], 2),
        'address': addr,
        'status': 'pending',
        'admin_notes': '',
        'expires_at': (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        'created_at': now_iso(),
    }
    await db.emi_applications.insert_one(app_doc.copy())
    app_doc.pop('_id', None)
    return app_doc

@api.get('/emi/applications')
async def my_applications(user=Depends(get_current_user)):
    return await db.emi_applications.find({'user_id': user['id']}, {'_id': 0}).sort('created_at', -1).to_list(200)

@api.get('/emi/applications/{aid}')
async def get_application(aid: str, user=Depends(get_current_user)):
    a = await db.emi_applications.find_one({'id': aid}, {'_id': 0})
    if not a: raise HTTPException(404)
    if user['role'] == 'customer' and a['user_id'] != user['id']: raise HTTPException(403)
    return a

@api.post('/emi/applications/{aid}/pay-downpayment')
async def pay_downpayment(aid: str, user=Depends(get_current_user)):
    a = await db.emi_applications.find_one({'id': aid})
    if not a or a['user_id'] != user['id']: raise HTTPException(404)
    if a['status'] != 'sanctioned': raise HTTPException(400, f'Application not sanctioned (status: {a["status"]})')

    # Verify product still in stock
    p = await db.products.find_one({'id': a['product']['id']})
    if not p or p['stock'] < a['qty']: raise HTTPException(400, 'Product out of stock')

    # Generate EMI schedule
    schedule = []
    base = datetime.now(timezone.utc)
    for i in range(a['tenure_months']):
        due = base + timedelta(days=30 * (i + 1))
        schedule.append({'installment': i + 1, 'due_date': due.isoformat(), 'amount': a['monthly_emi'], 'status': 'pending', 'paid_at': None})

    # Create order
    order = {
        'id': str(uuid.uuid4()), 'user_id': user['id'], 'user_name': user['name'], 'user_email': user['email'],
        'items': [{'product_id': p['id'], 'name': p['name'], 'image': p['image'], 'price': p['price'], 'qty': a['qty']}],
        'address': f"{a['address']['full_name']}, {a['address']['line1']}, {a['address']['city']}, {a['address']['state']} - {a['address']['pincode']}",
        'subtotal': a['total_price'], 'payment_method': 'emi', 'status': 'confirmed',
        'emi_application_id': aid, 'created_at': now_iso(),
    }
    await db.orders.insert_one(order.copy())
    await db.products.update_one({'id': p['id']}, {'$inc': {'stock': -a['qty']}})

    # Activate application
    await db.emi_applications.update_one({'id': aid}, {'$set': {
        'status': 'active', 'order_id': order['id'], 'schedule': schedule, 'activated_at': now_iso(),
    }})
    # Decrement credit limit
    await db.users.update_one({'id': user['id']}, {'$inc': {'used_limit': a['principal'], 'available_limit': -a['principal']}})
    return {'ok': True, 'order_id': order['id']}

@api.post('/emi/applications/{aid}/pay/{installment}')
async def pay_installment(aid: str, installment: int, user=Depends(get_current_user)):
    a = await db.emi_applications.find_one({'id': aid})
    if not a or a['user_id'] != user['id']: raise HTTPException(404)
    if a['status'] != 'active': raise HTTPException(400, 'EMI not active')
    schedule = a.get('schedule', [])
    found = False
    for s in schedule:
        if s['installment'] == installment:
            if s['status'] == 'paid': raise HTTPException(400, 'Already paid')
            s['status'] = 'paid'; s['paid_at'] = now_iso()
            found = True; break
    if not found: raise HTTPException(404, 'Installment not found')

    all_paid = all(s['status'] == 'paid' for s in schedule)
    updates: Dict[str, Any] = {'schedule': schedule}
    if all_paid:
        updates['status'] = 'completed'; updates['completed_at'] = now_iso()
        # Restore credit limit + bump score
        await db.users.update_one({'id': user['id']}, {
            '$inc': {'available_limit': a['principal'], 'used_limit': -a['principal'], 'credit_score': 15}
        })
    else:
        # Partial restore for on-time payment
        per = a['principal'] / a['tenure_months']
        await db.users.update_one({'id': user['id']}, {'$inc': {'available_limit': per, 'used_limit': -per}})
    await db.emi_applications.update_one({'id': aid}, {'$set': updates})
    return {'ok': True, 'completed': all_paid}

# ---------- Admin EMI ----------
@api.get('/admin/emi/applications')
async def admin_apps(status: Optional[str] = None, user=Depends(require_role('admin'))):
    q: Dict[str, Any] = {}
    if status: q['status'] = status
    return await db.emi_applications.find(q, {'_id': 0}).sort('created_at', -1).to_list(500)

@api.post('/admin/emi/applications/{aid}/sanction')
async def sanction(aid: str, body: EMISanctionIn, admin=Depends(require_role('admin'))):
    a = await db.emi_applications.find_one({'id': aid})
    if not a: raise HTTPException(404)
    if a['status'] != 'pending': raise HTTPException(400, 'Application not pending')
    updates: Dict[str, Any] = {'status': 'sanctioned', 'admin_notes': body.notes, 'sanctioned_by': admin['id'], 'sanctioned_at': now_iso()}
    if body.interest_rate is not None:
        # recalculate
        principal = a['principal']
        monthly, total = calc_emi(principal, a['tenure_months'], body.interest_rate)
        updates.update({'interest_rate': body.interest_rate, 'monthly_emi': monthly,
                        'total_interest': round(total - principal, 2),
                        'total_payable': round(a['down_payment'] + total + a['processing_fee'], 2)})
    await db.emi_applications.update_one({'id': aid}, {'$set': updates})
    return {'ok': True}

@api.post('/admin/emi/applications/{aid}/reject')
async def reject(aid: str, body: EMIRejectIn, admin=Depends(require_role('admin'))):
    a = await db.emi_applications.find_one({'id': aid})
    if not a: raise HTTPException(404)
    await db.emi_applications.update_one({'id': aid}, {'$set': {
        'status': 'rejected', 'admin_notes': body.reason, 'rejected_by': admin['id'], 'rejected_at': now_iso()
    }})
    return {'ok': True}

# ---------- Admin stats ----------
@api.get('/admin/stats')
async def admin_stats(user=Depends(require_role('admin'))):
    total_revenue = 0.0
    async for o in db.orders.find({}, {'subtotal': 1}): total_revenue += o.get('subtotal', 0)
    users_count = await db.users.count_documents({})
    products_count = await db.products.count_documents({})
    orders_count = await db.orders.count_documents({})
    pending_emis = await db.emi_applications.count_documents({'status': 'pending'})
    active_emis = await db.emi_applications.count_documents({'status': 'active'})
    low_stock = await db.products.count_documents({'stock': {'$lt': 5}})
    # last 7 days revenue trend
    trend = []
    for i in range(6, -1, -1):
        day_start = (datetime.now(timezone.utc) - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        rev = 0.0
        async for o in db.orders.find({'created_at': {'$gte': day_start.isoformat(), '$lt': day_end.isoformat()}}, {'subtotal': 1}):
            rev += o.get('subtotal', 0)
        trend.append({'day': day_start.strftime('%a'), 'revenue': round(rev, 2)})
    return {
        'revenue': round(total_revenue, 2), 'users': users_count, 'products': products_count,
        'orders': orders_count, 'pending_emis': pending_emis, 'active_emis': active_emis, 'low_stock': low_stock,
        'trend': trend,
    }

@api.get('/admin/users')
async def admin_users(user=Depends(require_role('admin'))):
    users = await db.users.find({}, {'_id': 0, 'password': 0}).to_list(500)
    return users

@api.get('/admin/orders')
async def admin_orders(user=Depends(require_role('admin'))):
    return await db.orders.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)

# ---------- Inventory ----------
@api.get('/inventory/stats')
async def inv_stats(user=Depends(require_role('admin', 'inventory_manager'))):
    total = await db.products.count_documents({})
    low = await db.products.count_documents({'stock': {'$lt': 5}})
    out = await db.products.count_documents({'stock': 0})
    return {'total_products': total, 'low_stock': low, 'out_of_stock': out}

@api.get('/inventory/low-stock')
async def inv_low(user=Depends(require_role('admin', 'inventory_manager'))):
    return await db.products.find({'stock': {'$lt': 5}}, {'_id': 0}).to_list(200)

# ---------- Startup seed ----------
@app.on_event('startup')
async def startup():
    seed_users = [
        {'email': 'admin@loanex.com', 'password': 'admin123', 'name': 'Admin User', 'role': 'admin'},
        {'email': 'inventory@loanex.com', 'password': 'inventory123', 'name': 'Inventory Manager', 'role': 'inventory_manager'},
        {'email': 'customer@loanex.com', 'password': 'customer123', 'name': 'Rohan Kumar', 'role': 'customer'},
    ]
    for u in seed_users:
        if not await db.users.find_one({'email': u['email']}):
            doc = {
                'id': str(uuid.uuid4()), 'email': u['email'], 'name': u['name'], 'role': u['role'],
                'password': hash_pw(u['password']), 'created_at': now_iso(),
                'kyc_status': 'not_submitted',
                'credit_score': 720 if u['role'] == 'customer' else 650,
                'approved_limit': 150000.0 if u['role'] == 'customer' else 50000.0,
                'available_limit': 150000.0 if u['role'] == 'customer' else 50000.0,
                'used_limit': 0.0,
            }
            await db.users.insert_one(doc)
    if not await db.config.find_one({'_id': 'emi'}):
        await db.config.insert_one({'_id': 'emi', 'interest_rate': 12.0, 'threshold': 5000.0,
                                     'tenures': [3, 6, 12, 24], 'down_payment_percent': 20.0, 'processing_fee': 500.0})
    # replace product seed with INR pricing
    if await db.products.count_documents({}) == 0:
        products = [
            {'name': 'iPhone 15 Pro', 'brand': 'Apple', 'category': 'Mobiles', 'price': 134900, 'mrp': 149900, 'stock': 24,
             'description': 'A17 Pro chip, titanium design, 48MP camera system. The ultimate iPhone.',
             'image': 'https://images.unsplash.com/photo-1709178294947-42963a9a33b8?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'Display': '6.1" Super Retina XDR', 'Chip': 'A17 Pro', 'Storage': '256GB', 'Camera': '48MP Triple'}},
            {'name': 'MacBook Pro 14"', 'brand': 'Apple', 'category': 'Laptops', 'price': 199900, 'mrp': 219900, 'stock': 12,
             'description': 'M3 Pro chip, Liquid Retina XDR display, up to 22 hours battery.',
             'image': 'https://images.pexels.com/photos/11621727/pexels-photo-11621727.jpeg?auto=compress&cs=tinysrgb&w=940',
             'specifications': {'Chip': 'M3 Pro', 'RAM': '18GB', 'Storage': '512GB SSD', 'Display': '14.2"'}},
            {'name': 'Sony Bravia 65" 4K', 'brand': 'Sony', 'category': 'TVs', 'price': 129900, 'mrp': 149900, 'stock': 8,
             'description': 'Cognitive Processor XR, OLED, cinematic experience.',
             'image': 'https://images.pexels.com/photos/5202925/pexels-photo-5202925.jpeg?auto=compress&cs=tinysrgb&w=940',
             'specifications': {'Size': '65"', 'Resolution': '4K UHD', 'HDR': 'Dolby Vision'}},
            {'name': 'PlayStation 5', 'brand': 'Sony', 'category': 'Gaming', 'price': 54990, 'mrp': 59990, 'stock': 15,
             'description': 'Lightning-fast SSD, ray tracing, DualSense controller.',
             'image': 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'Storage': '825GB SSD', 'Resolution': '4K 120fps', 'Ray Tracing': 'Yes'}},
            {'name': 'Samsung Galaxy S24 Ultra', 'brand': 'Samsung', 'category': 'Mobiles', 'price': 129999, 'mrp': 139999, 'stock': 3,
             'description': '200MP camera, S Pen, Titanium frame, Galaxy AI.',
             'image': 'https://images.unsplash.com/photo-1707412818035-c2b53b0f47d4?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'Display': '6.8" QHD+', 'RAM': '12GB', 'Storage': '256GB'}},
            {'name': 'Sony WH-1000XM5', 'brand': 'Sony', 'category': 'Audio', 'price': 29990, 'mrp': 34990, 'stock': 30,
             'description': 'Industry-leading noise cancellation, 30hr battery.',
             'image': 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'Battery': '30 hours', 'Bluetooth': '5.2', 'ANC': 'Yes'}},
            {'name': 'Apple Watch Ultra 2', 'brand': 'Apple', 'category': 'Wearables', 'price': 89900, 'mrp': 94900, 'stock': 18,
             'description': 'Titanium case, precision GPS, most rugged Apple Watch.',
             'image': 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'Case': 'Titanium 49mm', 'GPS': 'Precision Dual-Freq', 'Battery': '36h'}},
            {'name': 'Dell XPS 15', 'brand': 'Dell', 'category': 'Laptops', 'price': 179900, 'mrp': 199900, 'stock': 6,
             'description': 'Intel Core Ultra 9, OLED 3.5K display, NVIDIA RTX.',
             'image': 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'CPU': 'Intel Core Ultra 9', 'GPU': 'RTX 4070', 'Display': '15.6" OLED 3.5K'}},
            {'name': 'LG C3 OLED 55"', 'brand': 'LG', 'category': 'TVs', 'price': 149900, 'mrp': 169900, 'stock': 4,
             'description': 'OLED evo, α9 AI Processor Gen6, Dolby Vision.',
             'image': 'https://images.unsplash.com/photo-1461151304267-38535e780c79?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'Size': '55"', 'Type': 'OLED evo', 'HDR': 'Dolby Vision IQ'}},
            {'name': 'Xbox Series X', 'brand': 'Microsoft', 'category': 'Gaming', 'price': 54990, 'mrp': 59990, 'stock': 10,
             'description': '12 TFLOPS, 4K gaming, Quick Resume.',
             'image': 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'GPU': '12 TFLOPS', 'Resolution': '4K 120Hz', 'Storage': '1TB NVMe'}},
            {'name': 'boAt Rockerz 550', 'brand': 'boAt', 'category': 'Audio', 'price': 1999, 'mrp': 4999, 'stock': 50,
             'description': 'Bluetooth headphones with 20 hours playback and dual pairing.',
             'image': 'https://images.unsplash.com/photo-1583394838336-acd977736f90?crop=entropy&cs=srgb&fm=jpg&w=940&q=85',
             'specifications': {'Battery': '20 hours', 'Bluetooth': '5.0', 'Drivers': '50mm'}},
        ]
        for p in products:
            p['id'] = str(uuid.uuid4()); p['emi_eligible'] = True
            p['rating'] = 0.0; p['review_count'] = 0; p['created_at'] = now_iso()
            await db.products.insert_one(p.copy())

@app.on_event('shutdown')
async def shutdown(): client.close()

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
logging.basicConfig(level=logging.INFO)
