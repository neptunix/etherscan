# Simple Ethereum network scanner

## Database

Let's create db to store eth blocks and transactions data
`docker-compose up -d -f src/db/postgres.yml`

This will create new docker network (db_default) and attach 2 new containers to it. Use adminer port to login: `http://localhost:18402`
Parameters:

* type: postresql
* server: db
* username: postgres
* password: etherscan-etherscan-etherscan
* database: postgres