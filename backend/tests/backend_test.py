"""LoanEX — backend API tests (pytest)

Covers auth, credit, KYC, addresses, products, reviews, EMI config/calc,
full EMI application lifecycle (pending -> sanctioned -> active -> completed),
direct orders, admin stats + RBAC, no _id leaks.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://flex-pay-store-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@loanex.com", "password": "admin123"}
INV = {"email": "inventory@loanex.com", "password": "inventory123"}
CUST = {"email": "customer@loanex.com", "password": "customer123"}


# ---------- shared fixtures ----------
@pytest.fixture(scope="session")
def s():
    ss = requests.Session()
    ss.headers.update({"Content-Type": "application/json"})
    return ss


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def admin_token(s):
    return _login(s, ADMIN)["token"]


@pytest.fixture(scope="session")
def inv_token(s):
    return _login(s, INV)["token"]


@pytest.fixture(scope="session")
def cust_token(s):
    return _login(s, CUST)["token"]


@pytest.fixture(scope="session")
def fresh_customer(s):
    """Register a brand new customer (no KYC) for lifecycle tests."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "pass1234", "name": "TEST Lifecycle Customer"
    })
    assert r.status_code == 200, r.text
    return {"email": email, "token": r.json()["token"], "user": r.json()["user"]}


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def _no_mongo_id(obj):
    """recursive check that no dict contains '_id'"""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"Mongo _id leaked: keys={list(obj.keys())}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_mongo_id(v)


# ---------- Auth ----------
class TestAuth:
    def test_login_admin_returns_credit_fields(self, s):
        d = _login(s, ADMIN)
        assert d["user"]["role"] == "admin"
        for k in ("credit_score", "approved_limit", "available_limit", "used_limit", "kyc_status"):
            assert k in d["user"], f"missing {k}"
        _no_mongo_id(d)

    def test_login_customer(self, s):
        d = _login(s, CUST)
        assert d["user"]["role"] == "customer"
        # score may have grown due to KYC/EMI activity in prior test runs; seed minimum is 720
        assert d["user"]["credit_score"] >= 720
        assert d["user"]["approved_limit"] >= 150000.0

    def test_login_inventory(self, s):
        d = _login(s, INV)
        assert d["user"]["role"] == "inventory_manager"

    def test_login_bad(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_register_new_customer_defaults(self, s):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "T"})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["credit_score"] == 650
        assert u["approved_limit"] == 50000.0
        assert u["available_limit"] == 50000.0
        assert u["kyc_status"] == "not_submitted"

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Credit profile ----------
class TestCredit:
    def test_profile(self, s, cust_token):
        r = s.get(f"{API}/credit/profile", headers=H(cust_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("credit_score", "tier", "approved_limit", "available_limit", "used_limit", "utilization", "factors"):
            assert k in d
        assert isinstance(d["factors"], list) and len(d["factors"]) >= 3
        _no_mongo_id(d)


# ---------- Products & Categories ----------
class TestProducts:
    def test_list(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        _no_mongo_id(items)

    def test_get_by_id(self, s):
        pid = s.get(f"{API}/products").json()[0]["id"]
        r = s.get(f"{API}/products/{pid}")
        assert r.status_code == 200 and r.json()["id"] == pid

    def test_missing(self, s):
        r = s.get(f"{API}/products/nope-xyz")
        assert r.status_code == 404

    def test_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        for c in ("All", "Mobiles", "Laptops", "TVs", "Audio", "Gaming", "Wearables", "Appliances"):
            assert c in cats, f"missing category {c}"

    def test_filter_category(self, s):
        r = s.get(f"{API}/products", params={"category": "Mobiles"})
        assert r.status_code == 200
        for p in r.json():
            assert p["category"] == "Mobiles"

    def test_customer_cannot_create(self, s, cust_token):
        r = s.post(f"{API}/products", headers=H(cust_token), json={
            "name": "x", "brand": "x", "category": "Mobiles", "price": 1000,
            "description": "d", "image": "i"
        })
        assert r.status_code == 403


# ---------- Reviews ----------
class TestReviews:
    def test_review_flow(self, s, cust_token):
        pid = s.get(f"{API}/products").json()[0]["id"]
        r = s.post(f"{API}/products/{pid}/reviews", headers=H(cust_token),
                   json={"rating": 5, "comment": "TEST great"})
        assert r.status_code == 200, r.text
        review = r.json()
        assert review["rating"] == 5
        _no_mongo_id(review)
        # verify aggregated on product
        p = s.get(f"{API}/products/{pid}").json()
        assert p["review_count"] >= 1
        assert p["rating"] > 0

    def test_bad_rating(self, s, cust_token):
        pid = s.get(f"{API}/products").json()[0]["id"]
        r = s.post(f"{API}/products/{pid}/reviews", headers=H(cust_token),
                   json={"rating": 10, "comment": "x"})
        assert r.status_code == 400


# ---------- EMI Config & Calculator ----------
class TestEMIConfig:
    def test_get_config(self, s):
        r = s.get(f"{API}/emi/config")
        assert r.status_code == 200
        d = r.json()
        for k in ("interest_rate", "threshold", "tenures", "down_payment_percent", "processing_fee"):
            assert k in d, f"missing {k}"

    def test_calc(self, s):
        r = s.get(f"{API}/emi/calculate", params={"price": 50000, "tenure": 6})
        assert r.status_code == 200
        d = r.json()
        for k in ("down_payment", "principal", "monthly", "total_interest", "processing_fee", "total_payable", "eligible"):
            assert k in d, f"missing {k}"
        # down_payment_percent default 20% -> dp = 10000, principal = 40000
        assert d["down_payment"] == 10000.0
        assert d["principal"] == 40000.0
        assert d["monthly"] > 0
        assert d["eligible"] is True

    def test_calc_below_threshold(self, s):
        r = s.get(f"{API}/emi/calculate", params={"price": 100, "tenure": 3})
        assert r.status_code == 200
        assert r.json()["eligible"] is False

    def test_update_config_admin(self, s, admin_token):
        cur = s.get(f"{API}/emi/config").json()
        new = {"interest_rate": 13.5, "threshold": 6000.0, "tenures": [3, 6, 12, 24],
               "down_payment_percent": 25.0, "processing_fee": 750.0}
        r = s.put(f"{API}/emi/config", json=new, headers=H(admin_token))
        assert r.status_code == 200, r.text
        got = s.get(f"{API}/emi/config").json()
        assert got["interest_rate"] == 13.5
        assert got["down_payment_percent"] == 25.0
        # restore
        s.put(f"{API}/emi/config", json={
            "interest_rate": cur.get("interest_rate", 12.0),
            "threshold": cur.get("threshold", 5000.0),
            "tenures": cur.get("tenures", [3, 6, 12, 24]),
            "down_payment_percent": cur.get("down_payment_percent", 20.0),
            "processing_fee": cur.get("processing_fee", 500.0),
        }, headers=H(admin_token))

    def test_update_config_customer_forbidden(self, s, cust_token):
        r = s.put(f"{API}/emi/config", headers=H(cust_token),
                  json={"interest_rate": 5, "threshold": 100, "tenures": [3],
                        "down_payment_percent": 10, "processing_fee": 100})
        assert r.status_code == 403


# ---------- Full EMI Lifecycle (uses fresh_customer) ----------
class TestEMILifecycle:
    def test_00_emi_apply_before_kyc_fails(self, s, fresh_customer):
        products = s.get(f"{API}/products").json()
        p = next(x for x in products if x["price"] >= 10000 and x["stock"] > 0)
        r = s.post(f"{API}/emi/apply", headers=H(fresh_customer["token"]), json={
            "product_id": p["id"], "qty": 1, "tenure_months": 6, "address_id": "dummy"
        })
        assert r.status_code == 400
        assert "KYC" in r.text

    def test_01_kyc_submit(self, s, fresh_customer):
        r = s.post(f"{API}/kyc/submit", headers=H(fresh_customer["token"]), json={
            "aadhar": "111122223333", "pan": "ABCDE1234F",
            "housing_type": "owned", "monthly_income": 80000, "employer": "TEST Corp"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kyc_status"] == "verified"
        # 80000 // 10000 = 8 -> +160 -> 810
        assert d["credit_score"] == min(900, 650 + 8 * 20)
        # 80000 * 6 = 480000 within cap
        assert d["approved_limit"] == 480000.0

    def test_02_kyc_me(self, s, fresh_customer):
        r = s.get(f"{API}/kyc/me", headers=H(fresh_customer["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "verified"
        assert d.get("aadhar") == "111122223333"

    def test_03_add_address(self, s, fresh_customer):
        r = s.post(f"{API}/addresses", headers=H(fresh_customer["token"]), json={
            "label": "Home", "full_name": "TEST User", "phone": "9999999999",
            "line1": "1 TEST street", "city": "Mumbai", "state": "MH", "pincode": "400001",
            "is_default": True
        })
        assert r.status_code == 200
        addr = r.json()
        assert addr["id"]
        _no_mongo_id(addr)
        fresh_customer["address_id"] = addr["id"]

    def test_04_list_addresses(self, s, fresh_customer):
        r = s.get(f"{API}/addresses", headers=H(fresh_customer["token"]))
        assert r.status_code == 200
        addrs = r.json()
        assert len(addrs) >= 1
        _no_mongo_id(addrs)

    def test_05_apply_emi(self, s, fresh_customer):
        products = s.get(f"{API}/products").json()
        # pick something within available limit (480k) and above threshold (5k)
        p = next(x for x in products if 10000 <= x["price"] <= 200000 and x["stock"] > 0)
        r = s.post(f"{API}/emi/apply", headers=H(fresh_customer["token"]), json={
            "product_id": p["id"], "qty": 1, "tenure_months": 6,
            "address_id": fresh_customer["address_id"]
        })
        assert r.status_code == 200, r.text
        app_doc = r.json()
        assert app_doc["status"] == "pending"
        assert app_doc["tenure_months"] == 6
        assert app_doc["monthly_emi"] > 0
        _no_mongo_id(app_doc)
        fresh_customer["app_id"] = app_doc["id"]
        fresh_customer["principal"] = app_doc["principal"]

    def test_06_apply_invalid_tenure(self, s, fresh_customer):
        products = s.get(f"{API}/products").json()
        p = next(x for x in products if x["price"] >= 10000 and x["stock"] > 0)
        r = s.post(f"{API}/emi/apply", headers=H(fresh_customer["token"]), json={
            "product_id": p["id"], "qty": 1, "tenure_months": 7,
            "address_id": fresh_customer["address_id"]
        })
        assert r.status_code == 400

    def test_07_admin_lists_pending(self, s, admin_token, fresh_customer):
        r = s.get(f"{API}/admin/emi/applications", params={"status": "pending"}, headers=H(admin_token))
        assert r.status_code == 200
        ids = [a["id"] for a in r.json()]
        assert fresh_customer["app_id"] in ids

    def test_08_admin_sanction(self, s, admin_token, fresh_customer):
        r = s.post(f"{API}/admin/emi/applications/{fresh_customer['app_id']}/sanction",
                   headers=H(admin_token), json={"notes": "TEST sanctioned"})
        assert r.status_code == 200, r.text
        # verify status
        a = s.get(f"{API}/emi/applications/{fresh_customer['app_id']}", headers=H(fresh_customer["token"])).json()
        assert a["status"] == "sanctioned"
        assert a["admin_notes"] == "TEST sanctioned"

    def test_09_pay_downpayment_activates(self, s, fresh_customer):
        r = s.post(f"{API}/emi/applications/{fresh_customer['app_id']}/pay-downpayment",
                   headers=H(fresh_customer["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("order_id")
        a = s.get(f"{API}/emi/applications/{fresh_customer['app_id']}", headers=H(fresh_customer["token"])).json()
        assert a["status"] == "active"
        assert len(a["schedule"]) == 6
        assert all(s2["status"] == "pending" for s2 in a["schedule"])
        # credit limit should be decremented
        me = s.get(f"{API}/auth/me", headers=H(fresh_customer["token"])).json()
        assert me["used_limit"] >= fresh_customer["principal"] - 1

    def test_10_pay_installments_complete(self, s, fresh_customer):
        a = s.get(f"{API}/emi/applications/{fresh_customer['app_id']}", headers=H(fresh_customer["token"])).json()
        score_before = s.get(f"{API}/auth/me", headers=H(fresh_customer["token"])).json()["credit_score"]
        for i in range(1, len(a["schedule"]) + 1):
            r = s.post(f"{API}/emi/applications/{fresh_customer['app_id']}/pay/{i}",
                       headers=H(fresh_customer["token"]))
            assert r.status_code == 200, f"pay {i}: {r.text}"
        a2 = s.get(f"{API}/emi/applications/{fresh_customer['app_id']}", headers=H(fresh_customer["token"])).json()
        assert a2["status"] == "completed"
        # score bumps +15
        score_after = s.get(f"{API}/auth/me", headers=H(fresh_customer["token"])).json()["credit_score"]
        assert score_after == score_before + 15

    def test_11_double_pay_fails(self, s, fresh_customer):
        r = s.post(f"{API}/emi/applications/{fresh_customer['app_id']}/pay/1",
                   headers=H(fresh_customer["token"]))
        # already completed - should reject as not active
        assert r.status_code == 400


# ---------- EMI reject flow (separate application) ----------
class TestEMIReject:
    def test_reject_flow(self, s, admin_token):
        # self-contained: register + KYC + address inside this test to avoid xdist scope leaks
        email = f"TEST_rej_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register", json={"email": email, "password": "p1", "name": "TEST Rej"}).json()
        tok = reg["token"]
        s.post(f"{API}/kyc/submit", headers=H(tok), json={
            "aadhar": "1", "pan": "P", "housing_type": "owned", "monthly_income": 50000
        })
        addr = s.post(f"{API}/addresses", headers=H(tok), json={
            "label": "Home", "full_name": "TEST", "phone": "9",
            "line1": "1", "city": "X", "state": "Y", "pincode": "1", "is_default": True
        }).json()
        products = s.get(f"{API}/products").json()
        p = next(x for x in products if 10000 <= x["price"] <= 100000 and x["stock"] > 0)
        r = s.post(f"{API}/emi/apply", headers=H(tok), json={
            "product_id": p["id"], "qty": 1, "tenure_months": 3, "address_id": addr["id"]
        })
        assert r.status_code == 200, r.text
        aid = r.json()["id"]
        r2 = s.post(f"{API}/admin/emi/applications/{aid}/reject",
                    headers=H(admin_token), json={"reason": "TEST rejection reason"})
        assert r2.status_code == 200
        a = s.get(f"{API}/emi/applications/{aid}", headers=H(tok)).json()
        assert a["status"] == "rejected"
        assert a["admin_notes"] == "TEST rejection reason"


# ---------- Direct Order (no more payment_method/emi_tenure) ----------
class TestDirectOrder:
    def test_order_with_address_text(self, s, cust_token):
        products = s.get(f"{API}/products").json()
        p = next(x for x in products if x["stock"] > 0 and x["price"] < 5000)
        stock_before = p["stock"]
        r = s.post(f"{API}/orders", headers=H(cust_token), json={
            "items": [{"product_id": p["id"], "qty": 1}],
            "address_text": "TEST 123 direct order"
        })
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "confirmed"
        assert order["payment_method"] == "full"
        _no_mongo_id(order)
        stock_after = s.get(f"{API}/products/{p['id']}").json()["stock"]
        assert stock_after == stock_before - 1


# ---------- Admin stats & RBAC ----------
class TestAdminStats:
    def test_stats(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("revenue", "users", "products", "orders", "pending_emis", "active_emis", "low_stock", "trend"):
            assert k in d, f"missing {k}"
        assert isinstance(d["trend"], list) and len(d["trend"]) == 7
        assert "day" in d["trend"][0] and "revenue" in d["trend"][0]
        _no_mongo_id(d)

    def test_users_no_password(self, s, admin_token):
        r = s.get(f"{API}/admin/users", headers=H(admin_token))
        assert r.status_code == 200
        for u in r.json():
            assert "password" not in u
        _no_mongo_id(r.json())

    def test_admin_emi_filter(self, s, admin_token):
        r = s.get(f"{API}/admin/emi/applications", params={"status": "completed"}, headers=H(admin_token))
        assert r.status_code == 200
        for a in r.json():
            assert a["status"] == "completed"

    def test_rbac_customer_forbidden(self, s, cust_token):
        for path in ("/admin/stats", "/admin/users", "/admin/orders", "/admin/emi/applications"):
            r = s.get(f"{API}{path}", headers=H(cust_token))
            assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_rbac_inventory_forbidden(self, s, inv_token):
        for path in ("/admin/stats", "/admin/users", "/admin/orders", "/admin/emi/applications"):
            r = s.get(f"{API}{path}", headers=H(inv_token))
            assert r.status_code == 403, f"{path} -> {r.status_code}"


# ---------- Inventory ----------
class TestInventory:
    def test_stats(self, s, inv_token):
        r = s.get(f"{API}/inventory/stats", headers=H(inv_token))
        assert r.status_code == 200
        for k in ("total_products", "low_stock", "out_of_stock"):
            assert k in r.json()

    def test_low_stock(self, s, inv_token):
        r = s.get(f"{API}/inventory/low-stock", headers=H(inv_token))
        assert r.status_code == 200
        for p in r.json():
            assert p["stock"] < 5

    def test_customer_cannot_restock(self, s, cust_token):
        pid = s.get(f"{API}/products").json()[0]["id"]
        r = s.post(f"{API}/products/{pid}/restock", headers=H(cust_token), json={"quantity": 1})
        assert r.status_code == 403
