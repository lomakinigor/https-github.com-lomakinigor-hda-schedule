# Plans and Corrections

## Admin Panel Refinement

### Admin-only Event Detail Visibility
*   **Status**: Currently, the admin-only fields (Rent, Speaker Fee, Max Participants) are only visible and editable within the "New Event" form in the Admin Panel's "Мероприятия" tab.
*   **Required Correction**: Administrative information in event details on the main screen must be corrected to be visible to authorized personnel.
*   **Scope**: This visibility must apply ONLY to admins after clicking an event card on the main schedule screen.
*   **Implementation Strategy**: The current work has focused on the Admin Panel UI structure. Behavior wiring (connecting the event-click modal to these sensitive fields) will be completed in a follow-up task. 
*   **Gap**: The `EventDetails` component shown to users does not yet conditionalize the visibility of these sensitive fields based on the user's role.
