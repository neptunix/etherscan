-- Created by Vertabelo (http://vertabelo.com)
-- Last modification date: 2018-01-04 15:32:07.811

-- tables
-- Table: Accounts
CREATE SEQUENCE accounts_id_seq;
CREATE TABLE accounts
(
    id bigint NOT NULL DEFAULT nextval('accounts_id_seq'),
    account numeric(50,0) NOT NULL,
    CONSTRAINT accounts_pk PRIMARY KEY (id)
);
ALTER SEQUENCE accounts_id_seq OWNED BY accounts.id;
CREATE UNIQUE INDEX accounts_idx_account on accounts (account ASC);

-- Table: Blocks
CREATE TABLE blocks
(
    id int NOT NULL,
    date timestamp NOT NULL,
    transactions int NOT NULL DEFAULT (0),
    CONSTRAINT blocks_pk PRIMARY KEY (id)
);

-- Table: Transactions
CREATE SEQUENCE transactions_id_seq;
CREATE TABLE transactions
(
    id bigint NOT NULL DEFAULT nextval('transactions_id_seq'),
    transaction_hash numeric (80,0) NOT NULL,
    from_account bigint NOT NULL,
    to_account bigint NOT NULL,
    block_id int NOT NULL,
    wei numeric (20) NOT NULL,
    CONSTRAINT transactions_pk PRIMARY KEY (id)
);
    CREATE UNIQUE INDEX transactions_idx_hash on transactions (transaction_hash ASC);

CREATE TABLE settings
(
    id int NOT NULL,
    latest_block int NOT NULL DEFAULT(0),
    CONSTRAINT settings_pk PRIMARY KEY (id)
);

INSERT INTO "settings" ("id","latest_block") VALUES (1,0);


-- foreign keys

-- Reference: transactions_accounts_from (table: transactions)
ALTER TABLE transactions ADD CONSTRAINT transactions_accounts_from
FOREIGN KEY (from_account)
REFERENCES accounts (id) ON DELETE CASCADE
NOT DEFERRABLE 
INITIALLY IMMEDIATE;

-- Reference: transactions_accounts_to (table: transactions)
ALTER TABLE transactions ADD CONSTRAINT transactions_accounts_to
FOREIGN KEY (to_account)
REFERENCES accounts (id) ON DELETE CASCADE
NOT DEFERRABLE 
INITIALLY IMMEDIATE;

-- Reference: transactions_blocks (table: transactions)
ALTER TABLE transactions ADD CONSTRAINT transactions_blocks
FOREIGN KEY (block_id)
REFERENCES blocks (id) ON DELETE CASCADE
NOT DEFERRABLE 
INITIALLY IMMEDIATE;

-- End of file.
