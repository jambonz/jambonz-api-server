/* remove VIEW_ONLY permission for admin user as it will prevent write operations*/
delete from user_permissions;

delete from permissions;

insert into permissions (permission_sid, name, description)
values 
('ffbc342a-546a-11ed-bdc3-0242ac120002', 'VIEW_ONLY', 'Can view data but not make changes'),
('ffbc3a10-546a-11ed-bdc3-0242ac120002', 'PROVISION_SERVICES', 'Can provision services'),
('ffbc3c5e-546a-11ed-bdc3-0242ac120002', 'PROVISION_USERS', 'Can provision users');

