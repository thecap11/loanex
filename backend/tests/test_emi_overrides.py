"""LoanEX iteration 3 — per-product EMI overrides + enriched admin review + enhanced sanction.

Covers:
- POST /api/products with emi_overrides
- GET /api/emi/calculate variants (product overrides, no product, unknown product, no-overrides fallback)
- POST /api/emi/apply snapshots effective schema + enriched user_* fields
- GET /api/admin/emi/applications/{id} enrichment (user_stats, user_current)
- POST /api/admin/emi/applications/{id}/sanction with financial overrides (recompute + admin_edited=true)
- Sanction with notes-only (financials unchanged, admin_edited NOT set)
- Sanction after non-pending status -> 400
- RBAC: customer/inventory forbidden on admin sanction/detail
- No Mongo _id leaks
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


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def _no_mongo_id(obj):
    if isinstance(obj, dict):
        assert "_id" not in obj, f"Mongo _id leaked: keys={list(obj.keys())}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_mongo_id(v)


@pytest.fixture(scope="session")
def s():
    ss = requests.Session()
    ss.headers.update({"Content-Type": "application/json"})
    return ss


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def admin_token(s): return _login(s, ADMIN)["token"]


@pytest.fixture(scope="session")
def inv_token(s): return _login(s, INV)["token"]


@pytest.fixture(scope="session")
def cust_token(s): return _login(s, CUST)["token"]


# ------------------------------------------------------------------
# Session-scoped: create ONE product with overrides + one without,
# reused across the module.
# ------------------------------------------------------------------
PRODUCT_WITH_OVERRIDES_PRICE = 80000.0

OVERRIDES = {
    "interest_rate": 9.5,
    "tenures": [3, 6, 9, 12],
    "down_payment_percent": 15.0,
    "processing_fee": 999.0,
    "custom_charges": [
        {"label": "Insurance", "amount": 5.0, "type": "percent"},   # 5% of 80000 = 4000
        {"label": "Extended Warranty", "amount": 1500.0, "type": "fixed"},
    ],
}


@pytest.fixture(scope="module")
def product_with_overrides(s, admin_token):
    body = {
        "name": f"TEST_ovr_{uuid.uuid4().hex[:6]}",
        "brand": "TESTBRAND", "category": "Mobiles",
        "price": PRODUCT_WITH_OVERRIDES_PRICE,
        "description": "TEST product with EMI overrides",
        "image": "https://example.com/x.png",
        "stock": 20, "emi_eligible": True,
        "emi_overrides": OVERRIDES,
    }
    r = s.post(f"{API}/products", headers=H(admin_token), json=body)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("emi_overrides") is not None
    _no_mongo_id(p)
    return p


@pytest.fixture(scope="module")
def product_no_overrides(s, admin_token):
    body = {
        "name": f"TEST_plain_{uuid.uuid4().hex[:6]}",
        "brand": "TESTBRAND", "category": "Mobiles",
        "price": 20000.0,
        "description": "TEST plain product",
        "image": "https://example.com/x.png",
        "stock": 20, "emi_eligible": True,
        # no emi_overrides
    }
    r = s.post(f"{API}/products", headers=H(admin_token), json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------
# 1. POST /api/products with emi_overrides
# ------------------------------------------------------------------
class TestProductOverrideCreate:
    def test_admin_can_create_with_overrides(self, product_with_overrides):
        p = product_with_overrides
        assert p["emi_overrides"]["interest_rate"] == 9.5
        assert p["emi_overrides"]["down_payment_percent"] == 15.0
        assert p["emi_overrides"]["processing_fee"] == 999.0
        assert len(p["emi_overrides"]["custom_charges"]) == 2

    def test_customer_cannot_create_product(self, s, cust_token):
        r = s.post(f"{API}/products", headers=H(cust_token), json={
            "name": "TEST_cust", "brand": "b", "category": "Mobiles", "price": 100,
            "description": "d", "image": "i", "emi_overrides": {"interest_rate": 5}
        })
        assert r.status_code == 403


# ------------------------------------------------------------------
# 2. GET /api/emi/calculate variants
# ------------------------------------------------------------------
class TestEMICalculate:
    def test_with_product_overrides(self, s, product_with_overrides):
        pid = product_with_overrides["id"]
        r = s.get(f"{API}/emi/calculate", params={"product_id": pid, "tenure": 6})
        assert r.status_code == 200, r.text
        d = r.json()
        # override values used
        assert d["interest_rate"] == 9.5
        assert d["down_payment_percent"] == 15.0
        assert d["processing_fee"] == 999.0
        # dp = 15% of 80000 = 12000
        assert d["down_payment"] == 12000.0
        assert d["principal"] == 68000.0
        # tenures come from override
        assert d["tenures"] == [3, 6, 9, 12]
        # custom_charges present + resolved
        assert isinstance(d["custom_charges"], list) and len(d["custom_charges"]) == 2
        by_label = {c["label"]: c for c in d["custom_charges"]}
        assert by_label["Insurance"]["type"] == "percent"
        # percent charge: 5% of 80000 = 4000
        assert by_label["Insurance"]["amount"] == 4000.0
        assert by_label["Extended Warranty"]["type"] == "fixed"
        assert by_label["Extended Warranty"]["amount"] == 1500.0
        # total = 4000 + 1500 = 5500
        assert d["custom_charges_total"] == 5500.0
        # total_payable includes dp + total-installments + processing_fee + charges_total
        assert d["total_payable"] >= d["down_payment"] + d["monthly"] * 6 + 999.0 + 5500.0 - 1
        assert d["eligible"] is True
        _no_mongo_id(d)

    def test_price_only_uses_global(self, s):
        r = s.get(f"{API}/emi/calculate", params={"price": 50000, "tenure": 6})
        assert r.status_code == 200
        d = r.json()
        # global config: default no custom charges
        assert d["custom_charges"] == []
        assert d["custom_charges_total"] == 0.0
        assert "down_payment_percent" in d
        assert "tenures" in d and isinstance(d["tenures"], list)

    def test_product_without_overrides_falls_back_to_global(self, s, product_no_overrides):
        pid = product_no_overrides["id"]
        # fetch current global cfg to compare
        cfg = s.get(f"{API}/emi/config").json()
        r = s.get(f"{API}/emi/calculate", params={"product_id": pid, "tenure": 6})
        assert r.status_code == 200
        d = r.json()
        assert d["interest_rate"] == cfg["interest_rate"]
        assert d["down_payment_percent"] == cfg["down_payment_percent"]
        assert d["processing_fee"] == cfg["processing_fee"]
        assert d["custom_charges"] == []
        assert d["custom_charges_total"] == 0.0
        assert d["tenures"] == cfg["tenures"]

    def test_nonexistent_product_returns_404(self, s):
        r = s.get(f"{API}/emi/calculate", params={"product_id": "does-not-exist-xyz", "tenure": 6})
        assert r.status_code == 404


# ------------------------------------------------------------------
# Helper: create a fresh customer + KYC + address to simulate real user
# ------------------------------------------------------------------
def _make_customer_with_kyc(s, monthly_income=100000):
    email = f"TEST_ovr_{uuid.uuid4().hex[:8]}@example.com"
    reg = s.post(f"{API}/auth/register", json={
        "email": email, "password": "pass1234", "name": "TEST Ovr"
    })
    assert reg.status_code == 200, reg.text
    tok = reg.json()["token"]
    s.post(f"{API}/kyc/submit", headers=H(tok), json={
        "aadhar": "111122223333", "pan": "ABCDE1234F",
        "housing_type": "owned", "monthly_income": monthly_income, "employer": "TEST Co"
    })
    addr = s.post(f"{API}/addresses", headers=H(tok), json={
        "label": "Home", "full_name": "TEST", "phone": "9999999999",
        "line1": "1 TEST", "city": "Mumbai", "state": "MH", "pincode": "400001",
        "is_default": True
    }).json()
    return {"email": email, "token": tok, "address_id": addr["id"]}


# ------------------------------------------------------------------
# 3. /api/emi/apply snapshots effective schema + enriched user_* fields
# ------------------------------------------------------------------
class TestEMIApplySnapshot:
    @pytest.fixture(scope="class")
    def applied(self, s, product_with_overrides):
        cust = _make_customer_with_kyc(s, monthly_income=100000)
        pid = product_with_overrides["id"]
        r = s.post(f"{API}/emi/apply", headers=H(cust["token"]), json={
            "product_id": pid, "qty": 1, "tenure_months": 6, "address_id": cust["address_id"]
        })
        assert r.status_code == 200, r.text
        app_doc = r.json()
        return {"cust": cust, "app": app_doc}

    def test_snapshot_uses_effective_schema(self, applied):
        a = applied["app"]
        # override interest = 9.5, override processing_fee = 999, dp 15% of 80000 = 12000
        assert a["interest_rate"] == 9.5
        assert a["processing_fee"] == 999.0
        assert a["down_payment"] == 12000.0
        assert a["principal"] == 68000.0
        # custom_charges snapshotted
        assert isinstance(a["custom_charges"], list) and len(a["custom_charges"]) == 2
        assert a["monthly_emi"] > 0
        _no_mongo_id(a)

    def test_snapshot_has_user_fields(self, applied):
        a = applied["app"]
        for k in ("user_phone", "user_approved_limit", "user_available_limit",
                  "user_used_limit", "user_kyc", "user_stats"):
            assert k in a, f"missing {k}"
        stats = a["user_stats"]
        for k in ("active_emis", "completed_emis", "rejected_emis"):
            assert k in stats
        # fresh customer never applied before
        assert stats["active_emis"] == 0
        assert stats["completed_emis"] == 0
        assert stats["rejected_emis"] == 0
        # user_kyc snapshot
        assert a["user_kyc"]["aadhar"] == "111122223333"

    def test_invalid_tenure_rejected_by_overrides(self, s, product_with_overrides):
        # override tenures = [3,6,9,12] so 24 must fail
        cust = _make_customer_with_kyc(s)
        r = s.post(f"{API}/emi/apply", headers=H(cust["token"]), json={
            "product_id": product_with_overrides["id"], "qty": 1,
            "tenure_months": 24, "address_id": cust["address_id"]
        })
        assert r.status_code == 400


# ------------------------------------------------------------------
# 4. Admin enrichment + 5. Sanction variants
# ------------------------------------------------------------------
class TestAdminSanction:
    @pytest.fixture(scope="class")
    def prepared(self, s, product_with_overrides):
        cust = _make_customer_with_kyc(s, monthly_income=100000)
        pid = product_with_overrides["id"]
        r = s.post(f"{API}/emi/apply", headers=H(cust["token"]), json={
            "product_id": pid, "qty": 1, "tenure_months": 6, "address_id": cust["address_id"]
        })
        assert r.status_code == 200
        return {"cust": cust, "app_id": r.json()["id"], "app": r.json()}

    def test_admin_detail_enrichment(self, s, admin_token, prepared):
        r = s.get(f"{API}/admin/emi/applications/{prepared['app_id']}", headers=H(admin_token))
        assert r.status_code == 200, r.text
        a = r.json()
        assert "user_stats" in a
        for k in ("active_emis", "completed_emis", "rejected_emis"):
            assert k in a["user_stats"]
        assert "user_current" in a
        for k in ("credit_score", "approved_limit", "available_limit", "used_limit", "kyc_status", "phone"):
            assert k in a["user_current"], f"missing user_current.{k}"
        _no_mongo_id(a)

    def test_admin_detail_404(self, s, admin_token):
        r = s.get(f"{API}/admin/emi/applications/does-not-exist-abc", headers=H(admin_token))
        assert r.status_code == 404

    def test_admin_detail_rbac_customer_forbidden(self, s, cust_token, prepared):
        r = s.get(f"{API}/admin/emi/applications/{prepared['app_id']}", headers=H(cust_token))
        assert r.status_code == 403

    def test_admin_detail_rbac_inventory_forbidden(self, s, inv_token, prepared):
        r = s.get(f"{API}/admin/emi/applications/{prepared['app_id']}", headers=H(inv_token))
        assert r.status_code == 403

    def test_sanction_rbac_customer_forbidden(self, s, cust_token, prepared):
        r = s.post(f"{API}/admin/emi/applications/{prepared['app_id']}/sanction",
                   headers=H(cust_token), json={"notes": "x"})
        assert r.status_code == 403

    def test_sanction_rbac_inventory_forbidden(self, s, inv_token, prepared):
        r = s.post(f"{API}/admin/emi/applications/{prepared['app_id']}/sanction",
                   headers=H(inv_token), json={"notes": "x"})
        assert r.status_code == 403


# ------------------------------------------------------------------
# Sanction with financial overrides (fresh app per test)
# ------------------------------------------------------------------
def _new_pending_app(s, product):
    cust = _make_customer_with_kyc(s, monthly_income=100000)
    r = s.post(f"{API}/emi/apply", headers=H(cust["token"]), json={
        "product_id": product["id"], "qty": 1, "tenure_months": 6, "address_id": cust["address_id"]
    })
    assert r.status_code == 200, r.text
    return cust, r.json()


class TestSanctionOverrides:
    def test_sanction_with_financial_overrides_recomputes(self, s, admin_token, product_with_overrides):
        cust, app = _new_pending_app(s, product_with_overrides)
        aid = app["id"]
        orig_monthly = app["monthly_emi"]
        # override to different interest rate & down payment
        r = s.post(f"{API}/admin/emi/applications/{aid}/sanction",
                   headers=H(admin_token), json={
                       "notes": "TEST override",
                       "interest_rate": 6.0,
                       "down_payment_amount": 20000.0,
                       "processing_fee": 250.0,
                       "custom_charges": [
                           {"label": "GST", "amount": 2.0, "type": "percent"},   # 2% of 80000 = 1600
                           {"label": "Handling", "amount": 300.0, "type": "fixed"},
                       ],
                   })
        assert r.status_code == 200, r.text
        # fetch
        a = s.get(f"{API}/admin/emi/applications/{aid}", headers=H(admin_token)).json()
        assert a["status"] == "sanctioned"
        assert a["admin_edited"] is True
        assert a["interest_rate"] == 6.0
        assert a["down_payment"] == 20000.0
        assert a["principal"] == 60000.0  # 80000 - 20000
        assert a["processing_fee"] == 250.0
        # custom charges recomputed
        by_label = {c["label"]: c for c in a["custom_charges"]}
        assert by_label["GST"]["amount"] == 1600.0
        assert by_label["Handling"]["amount"] == 300.0
        # monthly_emi should differ from original (rate change + principal change)
        assert a["monthly_emi"] != orig_monthly
        # total_payable ~ 20000 + 60000-ish repayment + 250 + 1900
        assert a["total_payable"] > 20000 + 250 + 1900
        _no_mongo_id(a)

    def test_sanction_notes_only_leaves_financials_untouched(self, s, admin_token, product_with_overrides):
        cust, app = _new_pending_app(s, product_with_overrides)
        aid = app["id"]
        before = {k: app[k] for k in ("interest_rate", "down_payment", "principal", "monthly_emi", "processing_fee", "total_payable")}
        r = s.post(f"{API}/admin/emi/applications/{aid}/sanction",
                   headers=H(admin_token), json={"notes": "TEST no financial change"})
        assert r.status_code == 200, r.text
        a = s.get(f"{API}/admin/emi/applications/{aid}", headers=H(admin_token)).json()
        assert a["status"] == "sanctioned"
        # admin_edited MUST NOT be True (either absent or False)
        assert a.get("admin_edited") in (None, False), f"admin_edited={a.get('admin_edited')}"
        for k, v in before.items():
            assert a[k] == v, f"{k} changed: before={v} after={a[k]}"
        assert a["admin_notes"] == "TEST no financial change"

    def test_sanction_non_pending_returns_400(self, s, admin_token, product_with_overrides):
        cust, app = _new_pending_app(s, product_with_overrides)
        aid = app["id"]
        # first sanction (moves to sanctioned)
        s.post(f"{API}/admin/emi/applications/{aid}/sanction",
               headers=H(admin_token), json={"notes": "first"})
        # second sanction should fail
        r = s.post(f"{API}/admin/emi/applications/{aid}/sanction",
                   headers=H(admin_token), json={"notes": "second"})
        assert r.status_code == 400


# ------------------------------------------------------------------
# Explicit test for percent vs fixed custom charge math
# ------------------------------------------------------------------
class TestCustomChargeMath:
    def test_percent_and_fixed_charges_on_calculate(self, s, product_with_overrides):
        # price = 80000, insurance 5% -> 4000; extended warranty 1500 fixed
        r = s.get(f"{API}/emi/calculate", params={"product_id": product_with_overrides["id"], "tenure": 6})
        d = r.json()
        by_label = {c["label"]: c for c in d["custom_charges"]}
        assert by_label["Insurance"]["amount"] == 4000.0     # 5% of 80000
        assert by_label["Extended Warranty"]["amount"] == 1500.0  # fixed
        assert d["custom_charges_total"] == 5500.0
