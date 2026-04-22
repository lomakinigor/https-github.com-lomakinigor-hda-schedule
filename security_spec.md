# Security Specification - Additional Expenses & Event Management

## 1. Data Invariants
- An Event `expenseList` item MUST have a `name` (string) and `amount` (number >= 0).
- Only an Admin can modify `expenseList` or `additionalExpenses`.
- `registeredCount` can be updated by any authenticated user (during registration) but ONLY that specific field.

## 2. The "Dirty Dozen" Payloads
1. **Unauthorized Expense Addition**: A participant tries to add an item to `expenseList`.
2. **Poisoned Expense Amount**: Admin tries (or attacker pretends to be admin) to set a negative amount in `expenseList`.
3. **ID Poisoning**: Request targets `/events/some-1MB-long-garbage-string`.
4. **Shadow Field Injection**: Adding `isVerified: true` to a user profile or admin status.
5. **Registration Spoofing**: Creating a registration for `userId: 'someone_else'`.
6. **Price Hijacking**: Participant tries to change event `price` while updating `registeredCount`.
7. **Stale Payment Status**: Participant tries to update their own `paymentStatus` to 'paid'.
8. **Invalid Status Transition**: Setting event status to 'invalid_status'.
9. **Large Payload Attack**: Sending 10,000 items in `expenseList`.
10. **Email Spoofing (Unverified)**: Trying to gain admin access with an unverified email `il17184@gmail.com`.
11. **Orphaned Registration**: Creating a registration for an `eventId` that does not exist.
12. **Negative Bonus**: User trying to set `bonusBalance` to a negative value.

## 3. Test Runner (Draft)
The `firestore.rules` will be updated to explicitly block these via helper functions and strict `MapDiff` checks.
