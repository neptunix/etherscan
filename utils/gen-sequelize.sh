#!/bin/bash

sequelize-auto -o "./src/models" -d etherscan -h localhost -u postgres -p 18401 -x etherscan-etherscan-etherscan -e postgres