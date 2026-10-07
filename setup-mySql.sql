CREATE DATABASE marsMission DEFAULT CHARACTER SET utf8 COLLATE utf8_bin;

USE marsMission;

CREATE TABLE Configuration
(
    indexingKey VARCHAR(254) NOT NULL,
    val TINYTEXT NOT NULL,
    PRIMARY KEY(indexingKey),
    UNIQUE INDEX indexingKey_UNIQUE(indexingKey ASC)
) DEFAULT CHARACTER SET = utf8;

CREATE TABLE Session
(
    id VARCHAR(128) NOT NULL,
    data TEXT NOT NULL,
    expiresAt BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY(id),
    INDEX(expiresAt)
) DEFAULT CHARACTER SET = utf8;

CREATE TABLE Actor
(
    id VARCHAR(36) NOT NULL,
    role TINYINT NOT NULL,
    name VARCHAR(30) NOT NULL,
    email VARCHAR(200) NOT NULL,
    password VARCHAR(300) NOT NULL,
    salt VARCHAR(200) NOT NULL,
    UNIQUE KEY(email),
    PRIMARY KEY(id)
) DEFAULT CHARACTER SET = utf8;

CREATE TABLE Actor$Passenger
(
    id VARCHAR(36) NOT NULL,
    tier TINYINT NOT NULL,
    PRIMARY KEY(id),
    FOREIGN KEY(id) REFERENCES Actor(id)
) DEFAULT CHARACTER SET = utf8;

CREATE TABLE Actor$Passenger$TierChange
(
    id VARCHAR(36) NOT NULL,
    passengerId VARCHAR(36) NOT NULL,
    oldTier TINYINT NOT NULL,
    newTier TINYINT NOT NULL,
    changedAt BIGINT UNSIGNED NOT NULL,
    changeBy VARCHAR(36) NOT NULL,
    reason VARCHAR(200) NOT NULL,
    PRIMARY KEY(id),
    FOREIGN KEY(passengerId) REFERENCES Actor$Passenger(id),
    FOREIGN KEY(changeBy) REFERENCES Actor(id)
) DEFAULT CHARACTER SET = utf8;

CREATE TABLE Resource
(
    id VARCHAR(36) NOT NULL,
    type TINYINT NOT NULL,
    status TINYINT NOT NULL,
    name VARCHAR(30) NOT NULL,
    description VARCHAR(200) NOT NULL,
    minimumTier TINYINT NOT NULL,
    PRIMARY KEY(id)
) DEFAULT CHARACTER SET = utf8;

INSERT INTO Configuration(indexingKey, val) VALUES('dbVersion', "1");