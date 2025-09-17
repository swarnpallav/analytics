# JSON Funnel Analyzer

🚀 **Transform raw JSON data into insightful funnels & flows — get insights in seconds!**

## Overview

JSON Funnel Analyzer is a powerful React application that allows you to:
- Import raw JSON data from various sources
- Automatically detect and visualize user funnels
- Create interactive flow diagrams
- Generate actionable insights and analytics
- Export visualizations and reports

## Features

- 📊 **Smart Funnel Detection**: Automatically identify conversion funnels from your data
- 🔄 **Interactive Flow Visualization**: Create dynamic flow charts with drag-and-drop functionality
- 🎯 **User Flow Diagram**: Visualize user journeys with clickable events and modal details
- 🪝 **Hook Name & Hook Screen Analysis**: Special support for tracking hook_name and hook_screen data
- 📈 **Real-time Analytics**: Get instant insights with conversion rates, drop-off points, and trends
- 🎨 **Customizable Dashboards**: Build personalized views for your data
- 📁 **Multiple Data Formats**: Support for JSON, CSV, and API integrations
- 🔍 **Advanced Filtering**: Drill down into specific user segments and time periods
- 📱 **Event Detail Modals**: Click on any event to view comprehensive details including hook data

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open your browser to `http://localhost:5173`

## Usage

1. **Import Data**: Upload your JSON files or connect to your API (sample data loads automatically)
2. **User Flow Diagram**: Navigate to the new "🎯 User Flow Diagram" tab to see your user journey visualization
3. **Interactive Events**: Click on any event in the flow diagram to see detailed information in a modal
4. **Hook Analysis**: Filter events by hook_name and hook_screen for targeted analysis
5. **Configure Funnels**: Define your conversion steps and goals in other tabs
6. **Analyze Insights**: Discover patterns, bottlenecks, and opportunities
7. **Export Results**: Save your findings for presentations and reports

### New User Flow Diagram Features

- **Screen-based Organization**: Events are grouped by `screenName` for better visualization
- **Hook Data Highlighting**: Events with `hook_name` and `hook_screen` are specially highlighted
- **Clickable Events**: Click any event to see full details including all label data
- **Transition Analysis**: View how users move between different screens
- **Filter Options**: Toggle to show only screens with hook data

## Tech Stack

- React 18 with Vite
- Modern data visualization libraries
- Responsive design with CSS modules
- TypeScript support (optional)

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
