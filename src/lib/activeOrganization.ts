export const getActiveOrganizationId = ({
  sessionOrganizationId,
  membershipOrganizationId,
  ownedOrganizationId,
}: {
  sessionOrganizationId?: string | null;
  membershipOrganizationId?: string | null;
  ownedOrganizationId?: string | null;
}) => {
  return sessionOrganizationId || membershipOrganizationId || ownedOrganizationId || null;
};