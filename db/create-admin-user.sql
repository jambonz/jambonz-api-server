/* hashed password is "admin" */
insert into users (user_sid, name, email, hashed_password, force_change, provider, email_validated)
values ('12c80508-edf9-4b22-8d09-55abd02648eb', 'admin', 'joe@foo.bar', '$argon2i$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$x5OO6gXFXS25oqUU2JvbYqrSgRxBujNUJBq6xv9EgjM', 1, 'local', 1);

insert into user_permissions (user_permissions_sid, user_sid, permission_sid) 
values ('8919e0dc-4d69-4de5-be56-a121598d9093', '12c80508-edf9-4b22-8d09-55abd02648eb', 'ffbc342a-546a-11ed-bdc3-0242ac120002');
insert into user_permissions (user_permissions_sid, user_sid, permission_sid) 
values ('d6fdf064-0a65-4b17-8b10-5500e956a159', '12c80508-edf9-4b22-8d09-55abd02648eb', 'ffbc3a10-546a-11ed-bdc3-0242ac120002');
insert into user_permissions (user_permissions_sid, user_sid, permission_sid) 
values ('f68185dd-0486-4767-a77d-a0b84c1b236e' ,'12c80508-edf9-4b22-8d09-55abd02648eb', 'ffbc3c5e-546a-11ed-bdc3-0242ac120002');