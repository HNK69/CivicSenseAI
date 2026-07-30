# CivicSenseAI

Unified Backend for Citizen and Officer Portals

## How to Run the Server

1. **Navigate to the server directory**:
   ```bash
   cd server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Environment Variables**:
   Copy the example config and fill it out:
   ```bash
   cp .env.example .env
   ```
   **Required variables**:
   - `MONGO_URI`: Your MongoDB connection string.
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: Random secure strings.
   - *Optional but needed for media:* `CLOUDINARY_*` keys.

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The backend will start on **http://localhost:5000**.

## How Frontends Connect

Both frontends (`client-user` and `client-officer`) connect to this single unified backend.
The server runs on **Port 5000** and serves two main sets of API routes.

### Client-User (Citizen App)
- **Base URL**: Runs on `http://localhost:3000`
- **Backend API target**: `http://localhost:5000/api`
- **Proxy/CORS**: The server accepts CORS from `http://localhost:3000`. The Vite config in `client-user` is typically set to proxy `/api` requests to `http://localhost:5000`.
- **API Scope**: Uses endpoints like `/api/auth/login`, `/api/issues`, `/api/notifications`.

### Client-Officer (Officer App)
- **Base URL**: Runs on `http://localhost:5173`
- **Backend API target**: `http://localhost:5000/api`
- **Proxy/CORS**: The server accepts CORS from `http://localhost:5173`. The `api.js` Axios instance in `client-officer` should point its `baseURL` to `http://localhost:5000/api`.
- **API Scope**: Uses endpoints like `/api/officer/auth/login`, `/api/officer/issues`, `/api/officer/work-orders`, etc.

### Socket.IO Real-time Connection
Both apps should connect their Socket.IO clients to `ws://localhost:5000`.
- **Citizens** join their personal room (`user:<id>`).
- **Officers** join their personal and departmental rooms (`officer:<id>` and `department:<dept>`).
- Both can subscribe to specific issues via `issue:<id>`.

## Development Assumptions & Notes

- **AI Service**: The FastAPI `ai-service` integration logic is fully stubbed out in `server/src/services/aiService.js`. Real Python AI logic is expected to run as a separate microservice. The Node.js server will communicate with it via HTTP requests.
- **Media Upload**: The file upload pipeline uses Multer with memory storage, immediately piping the buffers to Cloudinary using Cloudinary v2 SDK for reliability.
- **Department Model**: Departments are not managed via a dedicated DB collection. They are represented as simple string fields (`assignedDepartment` on `Issue`, `department` on `WorkOrder` and `Officer`). A routing map (`DEPT_MAP`) handles basic category-to-department assignments.
- **Mock Data Swap**: Frontend apps currently mock API data via JS structures. These need to be uncommented to hit the actual Axios instances now that the server is built.