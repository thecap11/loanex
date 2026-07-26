"""Onyx Electronics — backend API tests (pytest)"""
import os
import uuid
import pytest
import requests

BASE_URL = "https://flex-pay-store-1.preview.emergentagent.com".rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@onyx.com", "password": "admin123"}
INV = {"email": "inventory@onyx.com", "password": "inventory123"}
CUST = {"email": "customer@onyx.com", "password": "customer123"}


# ---------- shared session/token fixtures ----------
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


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def _no_mongo_id(obj):
    """recursive check that no dict contains a '_id' key"""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"Mongo _id leaked in response: {list(obj.keys())}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_mongo_id(v)


# ---------- Auth ----------
class TestAuth:
    def test_register_customer(self, s):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "pass1234", "name": "TEST user"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "customer"
        _no_mongo_id(data)

    def test_register_duplicate(self, s):
        email = f"TEST_dup_{uuid.uuid4().hex[:6]}@example.com"
        s.post(f"{API}/auth/register", json={"email": email, "password": "p1", "name": "d"})
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "p1", "name": "d"})
        assert r.status_code == 400

    def test_login_admin(self, s):
        d = _login(s, ADMIN)
        assert d["user"]["role"] == "admin"

    def test_login_inventory(self, s):
        d = _login(s, INV)
        assert d["user"]["role"] == "inventory_manager"

    def test_login_customer(self, s):
        d = _login(s, CUST)
        assert d["user"]["role"] == "customer"

    def test_login_bad_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, s, cust_token):
        r = s.get(f"{API}/auth/me", headers=H(cust_token))
        assert r.status_code == 200
        assert r.json()["email"] == CUST["email"]
        _no_mongo_id(r.json())

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Products & Categories ----------
class TestProducts:
    def test_list(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        assert {"id", "name", "price", "stock", "category"}.issubset(items[0].keys())
        _no_mongo_id(items)

    def test_get_by_id(self, s):
        pid = s.get(f"{API}/products").json()[0]["id"]
        r = s.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid
        _no_mongo_id(r.json())

    def test_get_missing(self, s):
        r = s.get(f"{API}/products/does-not-exist")
        assert r.status_code == 404

    def test_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert "All" in cats and "Phones" in cats

    def test_filter_by_category(self, s):
        r = s.get(f"{API}/products", params={"category": "Phones"})
        assert r.status_code == 200
        for p in r.json():
            assert p["category"] == "Phones"


# ---------- EMI ----------
class TestEMI:
    def test_config(self, s):
        r = s.get(f"{API}/emi/config")
        assert r.status_code == 200
        d = r.json()
        assert "interest_rate" in d and "threshold" in d and "tenures" in d
        assert 6 in d["tenures"]

    def test_calc(self, s):
        r = s.get(f"{API}/emi/calculate", params={"price": 1000, "tenure": 6})
        assert r.status_code == 200
        d = r.json()
        assert d["principal"] == 1000
        assert d["tenure"] == 6
        assert d["monthly"] > 0 and d["total"] > d["principal"]
        assert isinstance(d["eligible"], bool)

    def test_calc_below_threshold(self, s):
        r = s.get(f"{API}/emi/calculate", params={"price": 50, "tenure": 3})
        assert r.status_code == 200
        assert r.json()["eligible"] is False

    def test_update_config_admin(self, s, admin_token):
        # get current, mutate, restore
        cur = s.get(f"{API}/emi/config").json()
        new_cfg = {"interest_rate": 13.5, "threshold": 250.0, "tenures": [3, 6, 9, 12]}
        r = s.put(f"{API}/emi/config", json=new_cfg, headers=H(admin_token))
        assert r.status_code == 200
        assert s.get(f"{API}/emi/config").json()["interest_rate"] == 13.5
        # restore
        s.put(f"{API}/emi/config", json={
            "interest_rate": cur.get("interest_rate", 12.0),
            "threshold": cur.get("threshold", 200.0),
            "tenures": cur.get("tenures", [3, 6, 9, 12]),
        }, headers=H(admin_token))

    def test_update_config_forbidden_customer(self, s, cust_token):
        r = s.put(f"{API}/emi/config",
                  json={"interest_rate": 5, "threshold": 100, "tenures": [3]},
                  headers=H(cust_token))
        assert r.status_code == 403


# ---------- Cart + Orders end-to-end ----------
class TestOrdersFlow:
    def test_full_order_flow(self, s, cust_token):
        products = s.get(f"{API}/products").json()
        # pick cheapest in-stock product for full-payment test
        in_stock = [p for p in products if p["stock"] > 0]
        assert in_stock, "no in-stock products"
        cheap = min(in_stock, key=lambda p: p["price"])
        # add to cart
        r = s.post(f"{API}/cart/add", json={"product_id": cheap["id"], "qty": 1},
                   headers=H(cust_token))
        assert r.status_code == 200
        # verify cart contents
        cart = s.get(f"{API}/cart", headers=H(cust_token)).json()
        assert any(i["product"]["id"] == cheap["id"] for i in cart["items"])
        _no_mongo_id(cart)
        # remove
        s.post(f"{API}/cart/remove", json={"product_id": cheap["id"], "qty": 1},
               headers=H(cust_token))
        cart2 = s.get(f"{API}/cart", headers=H(cust_token)).json()
        assert not any(i["product"]["id"] == cheap["id"] for i in cart2["items"])

        # create full order (single item, capture initial stock)
        stock_before = s.get(f"{API}/products/{cheap['id']}").json()["stock"]
        r = s.post(f"{API}/orders", json={
            "items": [{"product_id": cheap["id"], "qty": 1}],
            "address": "TEST 123 Street",
            "payment_method": "full",
        }, headers=H(cust_token))
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["payment_method"] == "full"
        assert order["emi"] is None
        assert order["status"] == "confirmed"
        _no_mongo_id(order)
        # stock decremented
        stock_after = s.get(f"{API}/products/{cheap['id']}").json()["stock"]
        assert stock_after == stock_before - 1

    def test_emi_order_and_pay(self, s, cust_token):
        products = s.get(f"{API}/products").json()
        expensive = next(p for p in products if p["price"] >= 500 and p["stock"] > 0)
        # create EMI order
        r = s.post(f"{API}/orders", json={
            "items": [{"product_id": expensive["id"], "qty": 1}],
            "address": "TEST EMI Address",
            "payment_method": "emi",
            "emi_tenure": 6,
        }, headers=H(cust_token))
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["emi"] is not None
        assert order["emi"]["tenure"] == 6
        assert len(order["emi"]["schedule"]) == 6
        assert all(x["status"] == "pending" for x in order["emi"]["schedule"])
        assert order["emi"]["approval_status"] == "pending"
        _no_mongo_id(order)

        # pay installment 1
        r = s.post(f"{API}/orders/{order['id']}/pay-emi/1", headers=H(cust_token))
        assert r.status_code == 200
        # verify persisted
        o = s.get(f"{API}/orders/{order['id']}", headers=H(cust_token)).json()
        assert o["emi"]["schedule"][0]["status"] == "paid"
        assert o["emi"]["schedule"][0]["paid_at"] is not None
        # duplicate pay should 400
        r2 = s.post(f"{API}/orders/{order['id']}/pay-emi/1", headers=H(cust_token))
        assert r2.status_code == 400

    def test_emi_invalid_tenure(self, s, cust_token):
        products = s.get(f"{API}/products").json()
        expensive = next(p for p in products if p["price"] >= 500 and p["stock"] > 0)
        r = s.post(f"{API}/orders", json={
            "items": [{"product_id": expensive["id"], "qty": 1}],
            "address": "TEST",
            "payment_method": "emi",
            "emi_tenure": 7,
        }, headers=H(cust_token))
        assert r.status_code == 400

    def test_emi_below_threshold(self, s, cust_token):
        products = s.get(f"{API}/products").json()
        cheap = next((p for p in products if p["price"] < 200 and p["stock"] > 0), None)
        if not cheap:
            pytest.skip("no cheap product available")
        r = s.post(f"{API}/orders", json={
            "items": [{"product_id": cheap["id"], "qty": 1}],
            "address": "TEST",
            "payment_method": "emi",
            "emi_tenure": 3,
        }, headers=H(cust_token))
        assert r.status_code == 400


# ---------- Admin & RBAC ----------
class TestAdmin:
    def test_stats(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("revenue", "users", "products", "orders", "pending_emis", "low_stock"):
            assert k in d

    def test_users(self, s, admin_token):
        r = s.get(f"{API}/admin/users", headers=H(admin_token))
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 3
        assert all("password" not in u for u in users)
        _no_mongo_id(users)

    def test_orders(self, s, admin_token):
        r = s.get(f"{API}/admin/orders", headers=H(admin_token))
        assert r.status_code == 200
        _no_mongo_id(r.json())

    def test_emis_list_and_approve_reject(self, s, admin_token):
        r = s.get(f"{API}/admin/emis", headers=H(admin_token))
        assert r.status_code == 200
        emis = r.json()
        _no_mongo_id(emis)
        if not emis:
            pytest.skip("no EMI orders present")
        oid = emis[0]["id"]
        r_ap = s.post(f"{API}/admin/emis/{oid}/approve", headers=H(admin_token))
        assert r_ap.status_code == 200
        r_rj = s.post(f"{API}/admin/emis/{oid}/reject", headers=H(admin_token))
        assert r_rj.status_code == 200

    def test_rbac_customer_forbidden(self, s, cust_token):
        for path in ("/admin/stats", "/admin/users", "/admin/orders", "/admin/emis"):
            r = s.get(f"{API}{path}", headers=H(cust_token))
            assert r.status_code == 403, f"{path} => {r.status_code}"

    def test_rbac_inventory_forbidden(self, s, inv_token):
        for path in ("/admin/stats", "/admin/users", "/admin/orders", "/admin/emis"):
            r = s.get(f"{API}{path}", headers=H(inv_token))
            assert r.status_code == 403, f"{path} => {r.status_code}"


# ---------- Inventory ----------
class TestInventory:
    def test_stats(self, s, inv_token):
        r = s.get(f"{API}/inventory/stats", headers=H(inv_token))
        assert r.status_code == 200
        d = r.json()
        assert "total_products" in d and "low_stock" in d and "out_of_stock" in d

    def test_low_stock(self, s, inv_token):
        r = s.get(f"{API}/inventory/low-stock", headers=H(inv_token))
        assert r.status_code == 200
        items = r.json()
        for p in items:
            assert p["stock"] < 5
        _no_mongo_id(items)

    def test_restock(self, s, inv_token):
        pid = requests.get(f"{API}/products").json()[0]["id"]
        r = requests.post(f"{API}/products/{pid}/restock",
                          json={"quantity": 5}, headers={**H(inv_token), "Content-Type": "application/json"})
        assert r.status_code == 200, r.text
        # response returns updated product; just verify stock is a valid int and endpoint works
        assert isinstance(r.json()["stock"], int)
        assert r.json()["id"] == pid

    def test_customer_cannot_restock(self, s, cust_token):
        pid = requests.get(f"{API}/products").json()[0]["id"]
        r = s.post(f"{API}/products/{pid}/restock",
                   json={"quantity": 1}, headers=H(cust_token))
        assert r.status_code == 403
