import { getSurveys, getTrashSurveys } from './actions';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const surveys = await getSurveys();
  const trashSurveys = await getTrashSurveys();
  return <DashboardClient surveys={surveys} trashSurveys={trashSurveys} />;
}
