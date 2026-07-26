from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'onyx-secret-change-in-prod-2026')
JWT_ALGO = 'HS256'
JWT_EXPIRE_MIN = 60 * 24 * 7

app = FastAPI()
api = APIRouter(prefix='/api')

# ---------- Models ----------
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = 'customer'  # customer | admin | inventory_manager

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

class ProductIn(BaseModel):
    name: str
    brand: str
    category: str
    price: float
    description: str
    image: str
    stock: int = 0
    emi_eligible: bool = True

class Product(ProductIn):
    id: str
    created_at: str

class CartItemIn(BaseModel):
    product_id: str
    qty: int = 1

class OrderIn(BaseModel):
    items: List[CartItemIn]
    address: str
    payment_method: str  # 'full' | 'emi'
    emi_tenure: Optional[int] = None  # 3, 6, 9, 12

class RestockIn(BaseModel):
    quantity: int

class EMIConfig(BaseModel):
    interest_rate: float
    threshold: float
    tenures: List[int]

# ---------- Helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    payload = {
        'sub': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MIN),
    }
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
    if not user:
        raise HTTPException(401, 'User not found')
    return user

def require_role(*roles):
    async def checker(user=Depends(get_current_user)):
        if user['role'] not in roles:
            raise HTTPException(403, 'Insufficient permissions')
        return user
    return checker

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def get_emi_config():
    cfg = await db.config.find_one({'_id': 'emi'}, {'_id': 0})
    if not cfg:
        cfg = {'interest_rate': 12.0, 'threshold': 200.0, 'tenures': [3, 6, 9, 12]}
    return cfg

def calc_emi(principal: float, months: int, annual_rate: float):
    r = annual_rate / 12 / 100
    if r == 0:
        monthly = principal / months
    else:
        monthly = principal * r * ((1 + r) ** months) / (((1 + r) ** months) - 1)
    total = monthly * months
    return round(monthly, 2), round(total, 2)

# ---------- Routes: Auth ----------
@api.post('/auth/register')
async def register(body: UserRegister):
    if body.role not in ('customer', 'admin', 'inventory_manager'):
        raise HTTPException(400, 'Invalid role')
    if await db.users.find_one({'email': body.email}):
        raise HTTPException(400, 'Email already registered')
    user = {
        'id': str(uuid.uuid4()),
        'email': body.email,
        'name': body.name,
        'role': body.role,
        'password': hash_pw(body.password),
        'created_at': now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user['id'], user['role'])
    return {
        'token': token,
        'user': {'id': user['id'], 'email': user['email'], 'name': user['name'], 'role': user['role']}
    }

@api.post('/auth/login')
async def login(body: UserLogin):
    user = await db.users.find_one({'email': body.email})
    if not user or not verify_pw(body.password, user['password']):
        raise HTTPException(401, 'Invalid email or password')
    token = create_token(user['id'], user['role'])
    return {
        'token': token,
        'user': {'id': user['id'], 'email': user['email'], 'name': user['name'], 'role': user['role']}
    }

@api.get('/auth/me')
async def me(user=Depends(get_current_user)):
    return user

# ---------- Products ----------
@api.get('/products')
async def list_products(category: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if category and category != 'All':
        query['category'] = category
    if q:
        query['name'] = {'$regex': q, '$options': 'i'}
    items = await db.products.find(query, {'_id': 0}).to_list(200)
    return items

@api.get('/products/{pid}')
async def get_product(pid: str):
    p = await db.products.find_one({'id': pid}, {'_id': 0})
    if not p:
        raise HTTPException(404, 'Product not found')
    return p

@api.post('/products')
async def create_product(body: ProductIn, user=Depends(require_role('admin', 'inventory_manager'))):
    p = body.dict()
    p['id'] = str(uuid.uuid4())
    p['created_at'] = now_iso()
    await db.products.insert_one(p.copy())
    p.pop('_id', None)
    return p

@api.put('/products/{pid}')
async def update_product(pid: str, body: ProductIn, user=Depends(require_role('admin', 'inventory_manager'))):
    res = await db.products.update_one({'id': pid}, {'$set': body.dict()})
    if res.matched_count == 0:
        raise HTTPException(404, 'Not found')
    return await db.products.find_one({'id': pid}, {'_id': 0})

@api.delete('/products/{pid}')
async def delete_product(pid: str, user=Depends(require_role('admin'))):
    await db.products.delete_one({'id': pid})
    return {'ok': True}

@api.post('/products/{pid}/restock')
async def restock(pid: str, body: RestockIn, user=Depends(require_role('admin', 'inventory_manager'))):
    res = await db.products.update_one({'id': pid}, {'$inc': {'stock': body.quantity}})
    if res.matched_count == 0:
        raise HTTPException(404, 'Not found')
    return await db.products.find_one({'id': pid}, {'_id': 0})

# ---------- Categories ----------
@api.get('/categories')
async def categories():
    return ['All', 'Phones', 'Laptops', 'TVs', 'Audio', 'Gaming', 'Wearables']

# ---------- EMI Config & Calculator ----------
@api.get('/emi/config')
async def emi_config():
    return await get_emi_config()

@api.put('/emi/config')
async def update_emi_config(body: EMIConfig, user=Depends(require_role('admin'))):
    await db.config.update_one({'_id': 'emi'}, {'$set': body.dict()}, upsert=True)
    return body.dict()

@api.get('/emi/calculate')
async def emi_calc(price: float, tenure: int):
    cfg = await get_emi_config()
    monthly, total = calc_emi(price, tenure, cfg['interest_rate'])
    eligible = price >= cfg['threshold']
    return {
        'principal': price,
        'tenure': tenure,
        'interest_rate': cfg['interest_rate'],
        'monthly': monthly,
        'total': total,
        'eligible': eligible,
        'threshold': cfg['threshold'],
    }

# ---------- Cart ----------
@api.get('/cart')
async def get_cart(user=Depends(get_current_user)):
    cart = await db.carts.find_one({'user_id': user['id']}, {'_id': 0}) or {'user_id': user['id'], 'items': []}
    # enrich items
    result = []
    for it in cart.get('items', []):
        p = await db.products.find_one({'id': it['product_id']}, {'_id': 0})
        if p:
            result.append({'product': p, 'qty': it['qty']})
    return {'items': result}

@api.post('/cart/add')
async def add_to_cart(body: CartItemIn, user=Depends(get_current_user)):
    cart = await db.carts.find_one({'user_id': user['id']})
    if not cart:
        cart = {'user_id': user['id'], 'items': []}
    items = cart.get('items', [])
    found = False
    for it in items:
        if it['product_id'] == body.product_id:
            it['qty'] += body.qty
            found = True
    if not found:
        items.append({'product_id': body.product_id, 'qty': body.qty})
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

# ---------- Orders ----------
@api.post('/orders')
async def create_order(body: OrderIn, user=Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, 'No items')
    cfg = await get_emi_config()
    order_items = []
    total = 0.0
    for it in body.items:
        p = await db.products.find_one({'id': it.product_id}, {'_id': 0})
        if not p:
            raise HTTPException(400, f'Product {it.product_id} not found')
        if p['stock'] < it.qty:
            raise HTTPException(400, f'Insufficient stock for {p["name"]}')
        order_items.append({
            'product_id': p['id'],
            'name': p['name'],
            'image': p['image'],
            'price': p['price'],
            'qty': it.qty,
        })
        total += p['price'] * it.qty

    emi_plan = None
    if body.payment_method == 'emi':
        if not body.emi_tenure or body.emi_tenure not in cfg['tenures']:
            raise HTTPException(400, 'Invalid EMI tenure')
        if total < cfg['threshold']:
            raise HTTPException(400, f'Order below EMI threshold ${cfg["threshold"]}')
        monthly, grand_total = calc_emi(total, body.emi_tenure, cfg['interest_rate'])
        schedule = []
        base_date = datetime.now(timezone.utc)
        for i in range(body.emi_tenure):
            due = base_date + timedelta(days=30 * (i + 1))
            schedule.append({
                'installment': i + 1,
                'due_date': due.isoformat(),
                'amount': monthly,
                'status': 'pending',
                'paid_at': None,
            })
        emi_plan = {
            'tenure': body.emi_tenure,
            'interest_rate': cfg['interest_rate'],
            'monthly': monthly,
            'total_with_interest': grand_total,
            'schedule': schedule,
            'approval_status': 'pending',
        }

    order = {
        'id': str(uuid.uuid4()),
        'user_id': user['id'],
        'user_name': user['name'],
        'user_email': user['email'],
        'items': order_items,
        'address': body.address,
        'subtotal': round(total, 2),
        'payment_method': body.payment_method,
        'emi': emi_plan,
        'status': 'confirmed',
        'created_at': now_iso(),
    }
    await db.orders.insert_one(order.copy())
    # decrement stock
    for it in body.items:
        await db.products.update_one({'id': it.product_id}, {'$inc': {'stock': -it.qty}})
    # clear cart
    await db.carts.update_one({'user_id': user['id']}, {'$set': {'items': []}}, upsert=True)
    order.pop('_id', None)
    return order

@api.get('/orders')
async def my_orders(user=Depends(get_current_user)):
    orders = await db.orders.find({'user_id': user['id']}, {'_id': 0}).sort('created_at', -1).to_list(200)
    return orders

@api.get('/orders/{oid}')
async def get_order(oid: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({'id': oid}, {'_id': 0})
    if not o:
        raise HTTPException(404, 'Not found')
    if user['role'] == 'customer' and o['user_id'] != user['id']:
        raise HTTPException(403, 'Not yours')
    return o

@api.post('/orders/{oid}/pay-emi/{installment}')
async def pay_emi(oid: str, installment: int, user=Depends(get_current_user)):
    o = await db.orders.find_one({'id': oid})
    if not o or o['user_id'] != user['id']:
        raise HTTPException(404, 'Not found')
    if not o.get('emi'):
        raise HTTPException(400, 'No EMI plan')
    schedule = o['emi']['schedule']
    for s in schedule:
        if s['installment'] == installment:
            if s['status'] == 'paid':
                raise HTTPException(400, 'Already paid')
            s['status'] = 'paid'
            s['paid_at'] = now_iso()
            break
    else:
        raise HTTPException(404, 'Installment not found')
    await db.orders.update_one({'id': oid}, {'$set': {'emi.schedule': schedule}})
    return {'ok': True}

# ---------- Admin ----------
@api.get('/admin/stats')
async def admin_stats(user=Depends(require_role('admin'))):
    total_revenue = 0.0
    async for o in db.orders.find({}, {'subtotal': 1}):
        total_revenue += o.get('subtotal', 0)
    users_count = await db.users.count_documents({})
    products_count = await db.products.count_documents({})
    orders_count = await db.orders.count_documents({})
    pending_emis = await db.orders.count_documents({'emi.approval_status': 'pending'})
    low_stock = await db.products.count_documents({'stock': {'$lt': 5}})
    return {
        'revenue': round(total_revenue, 2),
        'users': users_count,
        'products': products_count,
        'orders': orders_count,
        'pending_emis': pending_emis,
        'low_stock': low_stock,
    }

@api.get('/admin/users')
async def admin_users(user=Depends(require_role('admin'))):
    return await db.users.find({}, {'_id': 0, 'password': 0}).to_list(500)

@api.get('/admin/orders')
async def admin_orders(user=Depends(require_role('admin'))):
    return await db.orders.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)

@api.get('/admin/emis')
async def admin_emis(user=Depends(require_role('admin'))):
    orders = await db.orders.find({'emi': {'$ne': None}}, {'_id': 0}).to_list(500)
    return orders

@api.post('/admin/emis/{oid}/approve')
async def approve_emi(oid: str, user=Depends(require_role('admin'))):
    await db.orders.update_one({'id': oid}, {'$set': {'emi.approval_status': 'approved'}})
    return {'ok': True}

@api.post('/admin/emis/{oid}/reject')
async def reject_emi(oid: str, user=Depends(require_role('admin'))):
    await db.orders.update_one({'id': oid}, {'$set': {'emi.approval_status': 'rejected'}})
    return {'ok': True}

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
    # seed users
    seed_users = [
        {'email': 'admin@onyx.com', 'password': 'admin123', 'name': 'Admin User', 'role': 'admin'},
        {'email': 'inventory@onyx.com', 'password': 'inventory123', 'name': 'Inventory Manager', 'role': 'inventory_manager'},
        {'email': 'customer@onyx.com', 'password': 'customer123', 'name': 'John Customer', 'role': 'customer'},
    ]
    for u in seed_users:
        if not await db.users.find_one({'email': u['email']}):
            await db.users.insert_one({
                'id': str(uuid.uuid4()),
                'email': u['email'],
                'name': u['name'],
                'role': u['role'],
                'password': hash_pw(u['password']),
                'created_at': now_iso(),
            })
    # seed emi config
    if not await db.config.find_one({'_id': 'emi'}):
        await db.config.insert_one({'_id': 'emi', 'interest_rate': 12.0, 'threshold': 200.0, 'tenures': [3, 6, 9, 12]})
    # seed products
    if await db.products.count_documents({}) == 0:
        products = [
            {'name': 'iPhone 15 Pro', 'brand': 'Apple', 'category': 'Phones', 'price': 1099.00, 'stock': 24,
             'description': 'A17 Pro chip, titanium design, 48MP camera system. The ultimate iPhone.',
             'image': 'https://images.unsplash.com/photo-1709178294947-42963a9a33b8?crop=entropy&cs=srgb&fm=jpg&w=940&q=85'},
            {'name': 'MacBook Pro 14"', 'brand': 'Apple', 'category': 'Laptops', 'price': 1999.00, 'stock': 12,
             'description': 'M3 Pro chip, Liquid Retina XDR display, up to 22 hours battery.',
             'image': 'https://images.pexels.com/photos/11621727/pexels-photo-11621727.jpeg?auto=compress&cs=tinysrgb&w=940'},
            {'name': 'Sony Bravia 65" 4K', 'brand': 'Sony', 'category': 'TVs', 'price': 1299.00, 'stock': 8,
             'description': 'Cognitive Processor XR, OLED, cinematic experience.',
             'image': 'https://images.pexels.com/photos/5202925/pexels-photo-5202925.jpeg?auto=compress&cs=tinysrgb&w=940'},
            {'name': 'PlayStation 5', 'brand': 'Sony', 'category': 'Gaming', 'price': 499.00, 'stock': 15,
             'description': 'Lightning-fast SSD, ray tracing, DualSense controller.',
             'image': 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?crop=entropy&cs=srgb&fm=jpg&w=940&q=85'},
            {'name': 'Samsung Galaxy S24 Ultra', 'brand': 'Samsung', 'category': 'Phones', 'price': 1199.00, 'stock': 3,
             'description': '200MP camera, S Pen, Titanium frame, Galaxy AI.',
             'image': 'https://images.unsplash.com/photo-1707412818035-c2b53b0f47d4?crop=entropy&cs=srgb&fm=jpg&w=940&q=85'},
            {'name': 'Sony WH-1000XM5', 'brand': 'Sony', 'category': 'Audio', 'price': 399.00, 'stock': 30,
             'description': 'Industry-leading noise cancellation, 30hr battery.',
             'image': 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?crop=entropy&cs=srgb&fm=jpg&w=940&q=85'},
            {'name': 'Apple Watch Ultra 2', 'brand': 'Apple', 'category': 'Wearables', 'price': 799.00, 'stock': 18,
             'description': 'Titanium case, precision GPS, most rugged Apple Watch.',
             'image': 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?crop=entropy&cs=srgb&fm=jpg&w=940&q=85'},
            {'name': 'Dell XPS 15', 'brand': 'Dell', 'category': 'Laptops', 'price': 1799.00, 'stock': 6,
             'description': 'Intel Core Ultra 9, OLED 3.5K display, NVIDIA RTX.',
             'image': 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?crop=entropy&cs=srgb&fm=jpg&w=940&q=85'},
            {'name': 'LG C3 OLED 55"', 'brand': 'LG', 'category': 'TVs', 'price': 1499.00, 'stock': 4,
             'description': 'OLED evo, α9 AI Processor Gen6, Dolby Vision.',
             'image': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?crop=entropy&cs=srgb&fm=jpg&w=940&q=85'},
            {'name': 'Xbox Series X', 'brand': 'Microsoft', 'category': 'Gaming', 'price': 549.00, 'stock': 10,
             'description': '12 TFLOPS, 4K gaming, Quick Resume.',
             'image': 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?crop=entropy&cs=srgb&fm=jpg&w=940&q=85'},
        ]
        for p in products:
            p['id'] = str(uuid.uuid4())
            p['emi_eligible'] = True
            p['created_at'] = now_iso()
            await db.products.insert_one(p.copy())

@app.on_event('shutdown')
async def shutdown():
    client.close()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.basicConfig(level=logging.INFO)
