import RecordsPage from './RecordsPage.jsx';
import { VEHICLES, PROPERTIES, EMPLOYMENT, FAMILY, WALLET_METHODS } from './configs.jsx';

// Thin route components. Each is a config applied to the shared RecordsPage, so all
// five screens are visually and behaviourally identical by construction.

export function VehiclesPage() { return <RecordsPage config={VEHICLES} />; }
export function PropertiesPage() { return <RecordsPage config={PROPERTIES} />; }
export function EmploymentPage() { return <RecordsPage config={EMPLOYMENT} />; }
export function FamilyPage() { return <RecordsPage config={FAMILY} />; }
export function WalletMethodsPage() { return <RecordsPage config={WALLET_METHODS} />; }
