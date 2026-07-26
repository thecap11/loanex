# LoanEX — Product Requirements

## Overview
Premium dark-themed mobile ecommerce app for electronics & appliances with a full Instant EMI (Equated Monthly Installments) engine, credit profiling, and three role-based dashboards. Rebranded from initial Onyx MVP, INR (₹) currency, JWT auth.

## Roles
- **Customer**: browse products → view credit → apply for EMI → wait for admin sanction → pay down payment → track monthly schedule.
- **Admin**: revenue & EMI KPIs, review EMI applications with sanction notes or reject reasons, product CRUD, EMI config (interest / down payment / fee / threshold / tenures).
- **Inventory Manager**: stock overview, restock modal, low-stock alerts.

## Core Features
1. JWT auth with role-based routing (email + password)
2. Product catalog (Electronics) with categories, search, filter chips
3. Product detail with real-time EMI calculator + reviews
4. Credit profile: score gauge (300–900), approved/available/used limits with utilization bar, scoring factors, EMI history
5. KYC verification (Aadhar/PAN/housing/income) — gates EMI applications; verifying bumps score and limit based on income
6. Full EMI lifecycle: **pending → sanctioned (admin notes) → active (after down-payment) → completed (after all EMIs paid, score bump)**; or **rejected** (with reason)
7. EMI Hub with tabs (Pending / Sanctioned / Active / Completed / Rejected) + payment schedule with per-installment pay button
8. Address book (multi-address with default, Home/Work/Other labels)
9. Direct order (full payment mock) with saved-address checkout
10. Product reviews & ratings (1–5 stars)
11. Admin EMI review with CIBIL-tier badge, sanction/reject modal with notes
12. Admin analytics: revenue, orders, users, pending/active EMIs, low-stock; 7-day revenue bar chart
13. Inventory: stock levels + restock modal + low-stock filter

## Tech
- Frontend: Expo Router 6 (file-based routing), React Native 0.81, expo-image, expo-linear-gradient
- Backend: FastAPI + Motor (MongoDB), bcrypt, PyJWT
- Storage: SecureStore for token, AsyncStorage for user
- Currency: ₹ (INR) via `@/src/utils/currency`

## Seeded data
- 11 electronics products in INR (iPhone 15 Pro ₹1,34,900; MacBook Pro ₹1,99,900; Sony TV ₹1,29,900; PS5 ₹54,990; Galaxy S24 Ultra ₹1,29,999; Sony WH-1000XM5 ₹29,990; Watch Ultra 2 ₹89,900; Dell XPS 15 ₹1,79,900; LG C3 OLED ₹1,49,900; Xbox Series X ₹54,990; boAt headphones ₹1,999 for below-threshold demo)
- 3 users (admin/inventory/customer) — see `test_credentials.md`
- Default EMI config: 12% APR, ₹5,000 threshold, tenures [3,6,12,24], 20% down payment, ₹500 processing fee
