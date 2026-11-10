# AI Workflow Note

## Tools Used

- **Claude Code (Desktop App):** I used Claude Code as an AI-assisted development tool throughout the project. It helped with project scaffolding, drafting the initial Express server and React components, writing tests, running builds, and performing browser-based testing.
- **Technical Documentation:** I consulted the official TipTap, Mammoth, and Node.js `node:sqlite` documentation to verify API usage, compatibility, and implementation details.

## Where AI Significantly Improved Development Efficiency

- **Scaffolding and Boilerplate:** AI helped generate the initial Express routes, SQLite database schema, React components, and CSS. This reduced the time spent on repetitive implementation tasks and allowed me to focus more on system architecture, feature decisions, and quality assurance.
- **Test Development:** I used AI assistance to develop API integration tests alongside the application routes. These tests covered important functionality, including sharing permissions, version conflicts (409 responses), input sanitization, and document imports.
- **Browser-Based Verification:** Claude Code assisted with testing the application through a browser using different demo accounts. This helped verify document ownership, shared document visibility, sharing functionality, data persistence after reloading, and read-only access.

## Technical Decisions, Corrections, and Improvements

Although AI accelerated development, I reviewed its suggestions and made several technical decisions and corrections to ensure the application worked reliably.

- **Dependency Selection:** I decided against using `better-sqlite3` because it requires native compilation on Windows and the deployment environment. Instead, I selected Node.js's built-in `node:sqlite`. I also pinned TipTap to version 2 because of changes in version 3 that affected toolbar active-state rendering.
- **Express 4 Error Handling:** The initial document import route used an asynchronous handler that could throw errors without Express 4 properly handling them. I corrected this by explicitly forwarding errors to `next()` to ensure failed uploads were handled correctly.
- **Dependency Compatibility:** An installation conflict occurred because the latest `@vitejs/plugin-react` required Vite 8. Rather than forcing incompatible peer dependencies, I selected version 4 of the plugin to maintain compatibility.
- **Share Dialog Performance:** I identified an unnecessary re-fetching issue caused by an inline `onClose` callback changing during editor re-renders. I corrected this by moving the callback reference into a React ref.
- **Seed Data Correction:** Browser testing revealed that newline characters were being removed from the seed HTML, causing words to run together. I corrected the whitespace handling to preserve proper formatting.
- **Circular Import Resolution:** I identified a circular dependency between `App.jsx` and `DocList.jsx` involving navigation functionality. I resolved this by moving the shared navigation logic into a separate `nav.js` module.
- **Scope Management:** I deliberately kept real-time collaboration outside the project scope. Instead, I implemented optimistic version checks to detect conflicting document updates. This was a conscious engineering decision to prioritize reliability and deliver the required functionality within the available time.

## How I Verified Correctness and Quality

I used a combination of automated testing, manual browser testing, and production build verification.

- **Automated Testing:** I ran `npm test`, which executed nine API integration tests against an in-memory SQLite database. These covered authentication, the three user roles, access revocation, 404-versus-403 responses, stale-save conflicts (409), XSS sanitization, input validation, and document imports.
- **Manual Browser Testing:** I tested the application using the Alice, Bob, and Carol demo accounts. I verified owned and shared document lists, autosave indicators, formatting persistence after a hard reload, and the ability to add users, change sharing permissions, and remove access.
- **Access Control Verification:** I confirmed that users with viewer permissions could access shared documents but could not edit their content or access the editing toolbar.
- **Document Import Testing:** I tested Markdown (`.md`) and text (`.txt`) imports through automated tests. I also generated a real Word (`.docx`) document to verify the import process, including preservation of bold formatting and conversion of the filename into the document title.
- **Production Build Verification:** I ran `npm run build` followed by `npm start` to confirm that the compiled application started and served correctly using the production execution path intended for Render deployment.

## Overall Reflection

AI played a significant role in accelerating development, particularly in generating boilerplate, assisting with test creation, and identifying implementation issues. However, I did not rely on generated code without verification. I reviewed the implementation, consulted technical documentation, corrected errors, made independent architectural decisions, and tested the final application.

The experience reinforced the importance of treating AI as a development assistant rather than a replacement for engineering judgment. The final implementation was guided by technical requirements, testing results, and deliberate decisions about maintainability, compatibility, security, and project scope.