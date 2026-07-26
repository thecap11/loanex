# Onyx Electronics — Product Requirements

## Overview
Premium dark-themed mobile ecommerce app for electronics with configurable EMI (installment) payments and three role-based dashboards.

## Roles
- **Customer**: browse products, add to cart, checkout with full/EMI payment, track orders & pay EMI installments.
- **Admin**: view revenue/orders/users KPIs, manage products (CRUD), approve/reject EMIs, manage users, configure EMI (rate, threshold, tenures).
- **Inventory Manager**: view stock levels, low-stock alerts, restock products.

## Core Features
1. JWT auth with role-based routing (email + password)
2. Product catalog (Electronics) with categories, search, filter chips
3. Product detail with real-time EMI calculator (3/6/9/12 months configurable)
4. Cart & checkout with EMI plan selection
5. Order tracking + EMI schedule with per-installment mock pay
6. Admin dashboard: stats (revenue, orders, users, pending EMIs, low stock), CRUD products, approve/reject EMI, user list, EMI config settings
7. Inventory dashboard: stock overview, restock modal, low-stock alerts

## Tech
- Frontend: Expo Router 6, React Native 0.81, expo-image, expo-linear-gradient
- Backend: FastAPI + Motor (MongoDB), bcrypt, PyJWT
- Storage: SecureStore for token, AsyncStorage for user

## Seeded data
- 10 electronics products (iPhone, MacBook, PS5, Sony TV, Galaxy, XM5, Watch Ultra, XPS, LG OLED, Xbox)
- 3 users (admin, inventory, customer) - see test_credentials.md
- EMI config: 12% APR, $200 threshold, tenures [3,6,9,12]
