# Mobile Coverage Review (March 30, 2026)

This review compares the current route surface and feature pages against the implemented mobile experience (`useIsMobile` branches + dedicated mobile components) to identify what is still missing or incomplete.

## Executive Summary

The app has solid mobile coverage for the primary inventory workflows (dashboard, tools, chemicals, kits list/detail, warehouses, checkout, reports, profile, settings, and high-level orders/requests dashboards). However, there are still notable gaps:

1. **Users management lacks a mobile implementation** (renders desktop table/drawer only).
2. **Order/request creation and detail flows are desktop-first** despite being reachable from mobile list UIs.
3. **Kit detail on mobile is only partially implemented** with explicit TODO/"coming soon" sections.
4. **Admin remains intentionally desktop-only** (likely acceptable by policy, but still a mobile capability gap).
5. **Automated mobile E2E coverage is missing** (Playwright only runs Desktop Chrome project).

---

## What is already mobile-enabled

These pages explicitly switch to dedicated mobile components using `useIsMobile`:

- Dashboard → `MobileDashboard`
- Tool Checkout → `MobileToolCheckout`
- Tools → `MobileToolsList`
- Chemicals → `MobileChemicalsList`
- Kits list/detail → `MobileKitsList`, `MobileKitDetailPage`
- Warehouses → `MobileWarehousesList`
- Reports → mobile reports variant
- Profile → `MobileProfile`
- Settings → `MobileSettings`
- Orders dashboard → `MobileOrdersList`
- Requests dashboard → `MobileRequestsList`

This means your core browse/list workflows are mostly covered on mobile.

---

## Gaps and Missing Work

## 1) Users page has no mobile variant

`UsersPage` does not use `useIsMobile` and always renders desktop components (`UsersTable`, `UserDrawer`).

**Impact**
- On phones, user management is likely difficult (dense table + desktop interaction patterns).

**What to add**
- `MobileUsersList` (search/filter, cards, quick actions).
- `MobileUserDetail`/`MobileUserEditor` with full create/edit/lockout controls.

---

## 2) Mobile list pages link into desktop-only order/request forms and detail views

From mobile:
- `MobileOrdersList` navigates to `/orders/new` and `/orders/:id`.
- `MobileRequestsList` navigates to `/requests/new` and `/requests/:id`.

But the target pages (`OrderCreationForm`, `RequestCreationForm`, `OrderDetailView`, `RequestDetailView`) do not branch on mobile and are desktop-heavy Ant Design layouts.

**Impact**
- Mobile users can enter these routes but face suboptimal UX, especially complex tables/forms and modal-heavy interactions.

**What to add**
- Dedicated mobile detail views for orders and requests.
- Dedicated mobile creation flows (stepper/card flow, mobile-safe controls).
- If not ready immediately, route to a clear `DesktopOnlyMessage` instead of dropping users into dense desktop UIs.

---

## 3) Kit detail mobile experience is incomplete

`MobileKitDetailPage` still contains placeholder navigation TODOs and explicit "coming soon" messaging for major sub-features (items/activity/more tabs).

**Impact**
- Users can see summary data but cannot complete full kit operations on mobile.

**What to add**
- Functional navigation/actions for boxes, items, issuance history.
- Mobile equivalents for pending reorders, messages, analytics.
- Remove placeholder text only after parity is reached.

---

## 4) Admin is intentionally desktop-only

`AdminPageWrapper` blocks mobile with `DesktopOnlyMessage`.

**Impact**
- No mobile admin capability by design.

**Recommendation**
- Keep this if policy requires desktop for safety/complexity.
- Otherwise define a minimum mobile admin scope (read-only health/status, emergency user unlock, announcement publishing).

---

## 5) Mobile automated test coverage is missing

Playwright is configured with only `Desktop Chrome`. No mobile project/device profile is configured.

**Impact**
- Regressions in mobile UI/flows can ship undetected.

**What to add**
- Add at least one Playwright mobile project (e.g., Pixel 7 / iPhone 13 profiles).
- Cover smoke flows: login, dashboard nav, tools list, checkout, orders/requests open/create, kit detail tabs.

---

## Prioritized implementation plan

1. **P0:** Add mobile-safe handling for `/orders/:id`, `/requests/:id`, `/orders/new`, `/requests/new` (either true mobile UIs or explicit desktop-only guard).
2. **P0:** Complete TODO/coming-soon sections in `MobileKitDetailPage` for critical operations.
3. **P1:** Build `Users` mobile surface.
4. **P1:** Add Playwright mobile project + smoke suite.
5. **P2:** Decide long-term admin-on-mobile scope and implement minimal safe subset if desired.

---

## Quick route-by-route status snapshot

- **Good mobile coverage:** dashboard, tools, chemicals, kits list, warehouses, tool checkout, reports, profile, settings, auth login.
- **Partial mobile coverage:** kits detail (summary yes, deeper operations incomplete).
- **Missing mobile coverage:** users page; orders/requests detail + creation pages.
- **Intentionally desktop-only:** admin.
