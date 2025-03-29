# Gamed-Backend: Fantasy Cricket API

A powerful backend service for a fantasy cricket gaming platform built with Nitro, H3, and Drizzle ORM.

## 🏗️ Technology Stack

- **Framework**: [Nitro](https://nitro.unjs.io/) - Universal JavaScript/TypeScript server framework
- **API**: [H3](https://github.com/unjs/h3) - Minimal H(TTP) framework built for high performance
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations
- **Validation**: [Zod](https://github.com/colinhacks/zod) for runtime type validation

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime & package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Gamed-Backend.git
cd Gamed-Backend

# Install dependencies
bun install

# Set up the database
bun run db:generate
bun run db:push

# Seed the database (optional)
bun run db:seed-all

# Start the development server
bun run dev
```

## 📊 Database Schema

The database schema represents a fantasy cricket gaming platform with the following key entities:

- **Users**: Player accounts with balance and status
- **Teams**: IPL and other cricket teams
- **Players**: Cricket players with stats and attributes
- **Matches**: Cricket matches with venues and teams
- **Contests**: Fantasy contests for matches
- **User Teams**: Fantasy teams created by users
- **Contest Enrollments**: Tracks which user teams are enrolled in which contests

## 🔌 API Endpoints

### Contest Management

#### Get All Contests for a Match
```
GET /api/ipl/contests?matchId={matchId}
```
Returns all contests for a specific match, grouped by contest type (MEGA, HEAD_TO_HEAD, PRACTICE, PREMIUM).

#### Create Contest
```
POST /api/ipl/contests
```
Creates a new contest for a match.

#### Get Contest Enrollments
```
GET /api/ipl/contests/{contestId}
```
Returns all teams enrolled in a specific contest.

### Team Management

#### Create Team for a Match
```
POST /api/ipl/contests/team/bymatch
```
Creates a new fantasy team for a match and enrolls it in a contest.

#### Enroll Team in Contest
```
POST /api/ipl/contests/team/byteam
```
Enrolls an existing team in a contest.

#### Get Team Details
```
GET /api/ipl/contests/team?teamId={teamId}
```
Returns detailed information about a team, including all selected players and contest enrollments.

#### Update Team
```
PATCH /api/ipl/contests/team
```
Updates an existing fantasy team (team name or player selections).

### Squad Management

#### Get Squad
```
GET /api/ipl/teams/squad?teamId={teamId}
```
Returns players in a squad grouped by their roles (BATSMAN, BOWLER, ALL_ROUNDER, WICKET_KEEPER).

## 🌱 Database Seeding

The project includes several seeding scripts to populate the database with test data:

```bash
# Seed users
bun run db:seed-user

# Seed contests
bun run db:seed-contest

# Seed teams
bun run db:seed-team

# Seed contest enrollments
bun run db:seed-enrollment

# Run all seed scripts in the correct order
bun run db:seed-all
```

## 🧪 Team Validation Rules

When creating or updating a fantasy team, the following validation rules are applied:

1. Each team must have exactly 11 players
2. Players must be from the teams participating in the match
3. Player distribution between teams must be balanced (5-6 players from each team)
4. Each team must include at least one player of each type (BATSMAN, BOWLER, ALL_ROUNDER, WICKET_KEEPER)
5. Maximum 5 players of any single type
6. Each team must have exactly one captain and one vice-captain
7. The same player cannot be both captain and vice-captain

## 🖥️ Development

### Available Scripts

- `bun run dev` - Start the development server
- `bun run build` - Build the application for production
- `bun run preview` - Preview the production build

### Database Tools

- `bun run db:generate` - Generate database schema based on Drizzle schema
- `bun run db:migrate` - Run database migrations
- `bun run db:push` - Push schema changes to the database
- `bun run db:studio` - Open Drizzle Studio to manage your database

## 📝 License

[MIT](LICENSE)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
