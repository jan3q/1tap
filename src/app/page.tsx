import { getSurveys } from './actions';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const surveys = await getSurveys();
  return <DashboardClient surveys={surveys} />;
}
