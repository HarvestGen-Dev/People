 INSERT INTO church_memberships (church_id, user_id, role)
  SELECT c.id, u.id, 'owner'
  FROM churches c
  JOIN auth.users u ON u.email = 'developer@harvestgen.org'
  WHERE c.slug = 'harvestgen'
  ON CONFLICT (church_id, user_id) DO UPDATE SET role = 'owner';