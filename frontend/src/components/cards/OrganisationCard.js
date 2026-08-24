import { EntityCard, EntityTableRow } from './EntityCard';
import constants from '../../constants.json';

const labels = constants.ORGANISATIONS;
const memberCount = (organisation) => parseInt(organisation.memberCount || 0, 10);

const OrganisationCard = ({ data: organisation, navigate }) => {
  if (!organisation) return null;
  return (
    <EntityCard
      eyebrow={labels.PAGE_EYEBROW}
      title={organisation.name}
      subtitle={organisation.description || labels.NO_DESCRIPTION_LABEL}
      stats={[
        { label: labels.MEMBERS_LABEL, value: memberCount(organisation), sub: labels.MEMBERS_SUB_LABEL },
        { label: labels.ID_LABEL, value: `#${organisation.id}`, sub: labels.ID_SUB_LABEL },
      ]}
      openLabel={labels.OPEN_BUTTON_LABEL}
      onOpen={() => organisation.id && navigate?.(`/organisations/${organisation.id}`)}
    />
  );
};

export default OrganisationCard;

export const ORGANISATION_TABLE_COLS = '2fr 1fr auto';

export function OrganisationTableRow({ data: organisation, navigate }) {
  return (
    <EntityTableRow
      title={organisation.name}
      subtitle={organisation.description}
      gridTemplateColumns={ORGANISATION_TABLE_COLS}
      columns={[{ value: `${memberCount(organisation)} ${labels.MEMBERS_LABEL.toLowerCase()}` }]}
      actionLabel={labels.MANAGE_BUTTON_LABEL}
      onOpen={() => navigate?.(`/organisations/${organisation.id}`)}
    />
  );
}
