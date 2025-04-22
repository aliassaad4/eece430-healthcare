# HealthEase Pro Connect

A comprehensive healthcare management system with both frontend and backend components.

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- MySQL Database

## Project Structure

```
health-ease-pro-connect/
├── backend/           # Backend server
│   ├── src/          # Source code
│   ├── prisma/       # Database schema and migrations
│   └── database/     # Database related files
└── src/              # Frontend code
    ├── public/       # Static assets
    └── ...           # React components and pages
```

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd health-ease-pro-connect
```

### 2. Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the backend directory with the following content:
```env
DATABASE_URL="mysql://username:password@localhost:3306/healthease_db"
JWT_SECRET="your-secret-key"
PORT=3000
```

4. Set up the database:
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

5. Start the backend server:
```bash
npm run dev
```

The backend server will run on `http://localhost:3000`

### 3. Frontend Setup

1. Open a new terminal and navigate to the project root:
```bash
cd health-ease-pro-connect
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Development

### Backend Development

- The backend uses Express.js with TypeScript
- Database operations are handled through Prisma ORM
- API endpoints are defined in the `src/routes` directory
- Models and controllers are in their respective directories

### Frontend Development

- Built with React and TypeScript
- Uses Vite as the build tool
- Styled with Tailwind CSS
- UI components from shadcn/ui
- State management with React Query

## Available Scripts

### Backend Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run prisma:studio # Open Prisma Studio for database management
```

### Frontend Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.
