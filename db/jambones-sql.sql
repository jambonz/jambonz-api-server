/* SQLEditor (MySQL (2))*/


DROP TABLE IF EXISTS `api_keys`;

DROP TABLE IF EXISTS `call_routes`;

DROP TABLE IF EXISTS `conference_participants`;

DROP TABLE IF EXISTS `queue_members`;

DROP TABLE IF EXISTS `calls`;

DROP TABLE IF EXISTS `phone_numbers`;

DROP TABLE IF EXISTS `applications`;

DROP TABLE IF EXISTS `conferences`;

DROP TABLE IF EXISTS `old_call`;

DROP TABLE IF EXISTS `queues`;

DROP TABLE IF EXISTS `subscriptions`;

DROP TABLE IF EXISTS `registered_users`;

DROP TABLE IF EXISTS `accounts`;

DROP TABLE IF EXISTS `service_providers`;

DROP TABLE IF EXISTS `phone_number_inventory`;

DROP TABLE IF EXISTS `voip_carriers`;

CREATE TABLE IF NOT EXISTS `api_keys`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`token` CHAR(36) NOT NULL UNIQUE ,
`account_id` INTEGER(10) UNSIGNED,
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='An authorization token that is used to access the REST api';

CREATE TABLE IF NOT EXISTS `applications`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`name` VARCHAR(255) NOT NULL,
`account_id` INTEGER(10) UNSIGNED NOT NULL,
`call_hook` VARCHAR(255),
`call_status_hook` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='A defined set of behaviors to be applied to phone calls with';

CREATE TABLE IF NOT EXISTS `call_routes`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`account_id` INTEGER(10) UNSIGNED NOT NULL,
`regex` VARCHAR(255) NOT NULL,
`application_id` INTEGER(10) UNSIGNED NOT NULL,
PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `conferences`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`name` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='An audio conference';

CREATE TABLE IF NOT EXISTS `conference_participants`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`call_id` INTEGER(10) UNSIGNED,
`conference_id` INTEGER(10) UNSIGNED NOT NULL,
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='A relationship between a call and a conference that it is co';

CREATE TABLE IF NOT EXISTS `old_call`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`parent_call_id` INTEGER(10) UNSIGNED UNIQUE ,
`application_id` INTEGER(10) UNSIGNED,
`status_url` VARCHAR(255),
`time_start` DATETIME NOT NULL,
`time_alerting` DATETIME,
`time_answered` DATETIME,
`time_ended` DATETIME,
`direction` ENUM('inbound','outbound'),
`inbound_phone_number_id` INTEGER(10) UNSIGNED,
`inbound_user_id` INTEGER(10) UNSIGNED,
`outbound_user_id` INTEGER(10) UNSIGNED,
`calling_number` VARCHAR(255),
`called_number` VARCHAR(255),
`caller_name` VARCHAR(255),
`status` VARCHAR(255) NOT NULL COMMENT 'Possible values are queued, ringing, in-progress, completed, failed, busy and no-answer',
`sip_uri` VARCHAR(255) NOT NULL,
`sip_call_id` VARCHAR(255) NOT NULL,
`sip_cseq` INTEGER NOT NULL,
`sip_from_tag` VARCHAR(255) NOT NULL,
`sip_via_branch` VARCHAR(255) NOT NULL,
`sip_contact` VARCHAR(255),
`sip_final_status` INTEGER UNSIGNED,
`sdp_offer` VARCHAR(4096),
`sdp_answer` VARCHAR(4096),
`source_address` VARCHAR(255) NOT NULL,
`source_port` INTEGER UNSIGNED NOT NULL,
`dest_address` VARCHAR(255),
`dest_port` INTEGER UNSIGNED,
`url` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `phone_numbers`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`number` VARCHAR(255) NOT NULL UNIQUE ,
`account_id` INTEGER(10) UNSIGNED NOT NULL,
`application_id` INTEGER(10) UNSIGNED,
`phone_number_inventory_id` INTEGER(10) UNSIGNED NOT NULL,
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='A phone number that has been assigned to an account';

CREATE TABLE IF NOT EXISTS `queues`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`name` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='A set of behaviors to be applied to parked calls';

CREATE TABLE IF NOT EXISTS `queue_members`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`call_id` INTEGER(10) UNSIGNED,
`queue_id` INTEGER(10) UNSIGNED NOT NULL,
`position` INTEGER,
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='A relationship between a call and a queue that it is waiting';

CREATE TABLE IF NOT EXISTS `registered_users`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`username` VARCHAR(255) NOT NULL,
`domain` VARCHAR(255) NOT NULL,
`sip_contact` VARCHAR(255) NOT NULL,
`sip_user_agent` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='An active sip registration';

CREATE TABLE IF NOT EXISTS `calls`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`parent_call_id` INTEGER(10) UNSIGNED UNIQUE ,
`application_id` INTEGER(10) UNSIGNED,
`status_url` VARCHAR(255),
`time_start` DATETIME NOT NULL,
`time_alerting` DATETIME,
`time_answered` DATETIME,
`time_ended` DATETIME,
`direction` ENUM('inbound','outbound'),
`inbound_phone_number_id` INTEGER(10) UNSIGNED,
`inbound_user_id` INTEGER(10) UNSIGNED,
`outbound_user_id` INTEGER(10) UNSIGNED,
`calling_number` VARCHAR(255),
`called_number` VARCHAR(255),
`caller_name` VARCHAR(255),
`status` VARCHAR(255) NOT NULL COMMENT 'Possible values are queued, ringing, in-progress, completed, failed, busy and no-answer',
`sip_uri` VARCHAR(255) NOT NULL,
`sip_call_id` VARCHAR(255) NOT NULL,
`sip_cseq` INTEGER NOT NULL,
`sip_from_tag` VARCHAR(255) NOT NULL,
`sip_via_branch` VARCHAR(255) NOT NULL,
`sip_contact` VARCHAR(255),
`sip_final_status` INTEGER UNSIGNED,
`sdp_offer` VARCHAR(4096),
`sdp_answer` VARCHAR(4096),
`source_address` VARCHAR(255) NOT NULL,
`source_port` INTEGER UNSIGNED NOT NULL,
`dest_address` VARCHAR(255),
`dest_port` INTEGER UNSIGNED,
`url` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='A phone call';

CREATE TABLE IF NOT EXISTS `service_providers`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`name` VARCHAR(255) NOT NULL UNIQUE ,
`description` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='An organization that provides communication services to its ';

CREATE TABLE IF NOT EXISTS `accounts`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`name` VARCHAR(255) NOT NULL,
`sip_realm` VARCHAR(255),
`service_provider_id` INTEGER(10) UNSIGNED NOT NULL,
`registration_hook` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='A single end-user of the platform';

CREATE TABLE IF NOT EXISTS `subscriptions`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`subscribed_user_id` INTEGER(10) UNSIGNED NOT NULL,
`event` VARCHAR(255),
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='An active sip subscription';

CREATE TABLE IF NOT EXISTS `voip_carriers`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`name` VARCHAR(255) NOT NULL UNIQUE ,
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='An external organization that can provide sip trunking and D';

CREATE TABLE IF NOT EXISTS `phone_number_inventory`
(
`id` INTEGER(10) UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE ,
`uuid` CHAR(36) NOT NULL UNIQUE ,
`number` VARCHAR(255) NOT NULL UNIQUE ,
`voip_carrier_id` INTEGER(10) UNSIGNED NOT NULL,
PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='Telephone numbers (DIDs) that have been procured from a voip';

ALTER TABLE `api_keys` ADD FOREIGN KEY account_id_idxfk (`account_id`) REFERENCES `accounts` (`id`);

CREATE INDEX `applications_name_idx` ON `applications` (`name`);
ALTER TABLE `applications` ADD FOREIGN KEY account_id_idxfk_1 (`account_id`) REFERENCES `accounts` (`id`);

ALTER TABLE `call_routes` ADD FOREIGN KEY account_id_idxfk_2 (`account_id`) REFERENCES `accounts` (`id`);

ALTER TABLE `call_routes` ADD FOREIGN KEY application_id_idxfk (`application_id`) REFERENCES `applications` (`id`);

ALTER TABLE `conference_participants` ADD FOREIGN KEY call_id_idxfk (`call_id`) REFERENCES `calls` (`id`);

ALTER TABLE `conference_participants` ADD FOREIGN KEY conference_id_idxfk (`conference_id`) REFERENCES `conferences` (`id`);

ALTER TABLE `old_call` ADD FOREIGN KEY parent_call_id_idxfk (`parent_call_id`) REFERENCES `old_call` (`id`);

ALTER TABLE `old_call` ADD FOREIGN KEY application_id_idxfk_1 (`application_id`) REFERENCES `old_call` (`parent_call_id`);

ALTER TABLE `phone_numbers` ADD FOREIGN KEY account_id_idxfk_3 (`account_id`) REFERENCES `accounts` (`id`);

ALTER TABLE `phone_numbers` ADD FOREIGN KEY application_id_idxfk_2 (`application_id`) REFERENCES `applications` (`id`);

ALTER TABLE `phone_numbers` ADD FOREIGN KEY phone_number_inventory_id_idxfk (`phone_number_inventory_id`) REFERENCES `phone_number_inventory` (`id`);

ALTER TABLE `queue_members` ADD FOREIGN KEY call_id_idxfk_1 (`call_id`) REFERENCES `calls` (`id`);

ALTER TABLE `queue_members` ADD FOREIGN KEY queue_id_idxfk (`queue_id`) REFERENCES `queues` (`id`);

ALTER TABLE `calls` ADD FOREIGN KEY parent_call_id_idxfk_1 (`parent_call_id`) REFERENCES `calls` (`id`);

ALTER TABLE `calls` ADD FOREIGN KEY application_id_idxfk_3 (`application_id`) REFERENCES `calls` (`parent_call_id`);

ALTER TABLE `calls` ADD FOREIGN KEY inbound_phone_number_id_idxfk (`inbound_phone_number_id`) REFERENCES `phone_numbers` (`id`);

ALTER TABLE `calls` ADD FOREIGN KEY inbound_user_id_idxfk (`inbound_user_id`) REFERENCES `registered_users` (`id`);

ALTER TABLE `calls` ADD FOREIGN KEY outbound_user_id_idxfk (`outbound_user_id`) REFERENCES `registered_users` (`id`);

CREATE INDEX `service_providers_name_idx` ON `service_providers` (`name`);
CREATE INDEX `accounts_name_idx` ON `accounts` (`name`);
ALTER TABLE `accounts` ADD FOREIGN KEY service_provider_id_idxfk (`service_provider_id`) REFERENCES `service_providers` (`id`);

ALTER TABLE `subscriptions` ADD FOREIGN KEY subscribed_user_id_idxfk (`subscribed_user_id`) REFERENCES `registered_users` (`id`);

ALTER TABLE `phone_number_inventory` ADD FOREIGN KEY voip_carrier_id_idxfk (`voip_carrier_id`) REFERENCES `voip_carriers` (`id`);
