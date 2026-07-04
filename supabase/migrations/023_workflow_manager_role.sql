-- 023_workflow_manager_role.sql

-- Update the check constraints on church_memberships and church_invitations 
-- to support 'workflow_manager' role

ALTER TABLE church_memberships
DROP CONSTRAINT IF EXISTS church_memberships_role_check;

ALTER TABLE church_memberships
ADD CONSTRAINT church_memberships_role_check 
CHECK (role IN ('owner', 'admin', 'workflow_manager', 'member'));

ALTER TABLE church_invitations
DROP CONSTRAINT IF EXISTS church_invitations_role_check;

ALTER TABLE church_invitations
ADD CONSTRAINT church_invitations_role_check 
CHECK (role IN ('owner', 'admin', 'workflow_manager', 'member'));
