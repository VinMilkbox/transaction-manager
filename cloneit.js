'use strict';
//version 1.1.4

const SQLBuilder = require('json-sql-builder2');
var sql = new SQLBuilder('MySQL');
const { jsonCopy } = require('./util');

const checkAccessField = ({ query, userScopes, invokingService, tableName, allowedUserScopes }) => {
	const userScopesArray = userScopes.split(' ');
	const allowedFieldsForUser = [
		...new Set(
			userScopesArray
				.map((m) => {
					if (!allowedUserScopes[m] || !allowedUserScopes[m][tableName] || !allowedUserScopes[m][tableName].columns) {
						return null;
					}

					let outArray = [];
					outArray = outArray.concat(allowedUserScopes[m][tableName].columns);
					//outArray = outArray.concat(allowedUserScopes[m][tableName].columns.map(m => `${tableName}.${m}`)); //joins not supported
					return outArray;
				})
				.flat()
		),
	].filter((el) => el); //removing nulls

	if (allowedFieldsForUser.length == 0) {
		throw new Error('Not allowed to select on this table');
	}

	if (!query.fields) {
		return allowedFieldsForUser;
	}

	const fields = query.fields.split(',').map((m) => m.trim());
	if (fields.length == 0) {
		return allowedFieldsForUser;
	}

	const union = fields.filter((x) => allowedFieldsForUser.includes(x));
	if (union.length == 0) {
		return allowedFieldsForUser;
	}

	//TODO: check for difference and error if you are tring to access somthing u dont have access to @daria
	return union;
};

//FIXME: this does not work exactly the way i want, i want to also restrict people from filtering for columns they dont have access to view
const checkWhereFilter = ({ query, allowedFieldsForUser, invokingService, tableName, accountId }) => {
	if (!query.where || typeof query.where != 'object') {
		console.info('no where clause, returning all results');
		return {
			account_id: accountId,
		};
	}

	if (query.where.account_id) {
		throw new Error('Invalid Account');
	}

	const q = {
		$and: [
			jsonCopy(query.where),
			{
				account_id: accountId,
			},
		],
	};

	return q;

	//["1", "2", "3", "4", "5", "5.test", "5.tester", "5.tester.name", "count", "counter", "counter.count"]
	// const deepKeys = getDeepKeys(query.where);

	// const fields = query.fields.split(',');
	// if (fields.length == 0) {
	// 	return allowedFieldsForUser;
	// }

	// return fields.filter(x => allowedFieldsForUser.includes(x));
};

const getLimit = (limit) => {
	if (!limit) {
		return 10;
	}

	limit = parseInt(limit);
	if (isNaN(limit)) {
		throw new Error('Bad request: limit.');
	}

	if (limit <= 0 || limit > 1000) {
		throw new Error('Bad request: limit..');
	}

	return limit;
};

const getOffset = (offset) => {
	if (!offset) {
		return 0;
	}

	offset = parseInt(offset);
	if (isNaN(offset)) {
		throw new Error('Bad request: offset.');
	}
	if (offset < 0) {
		throw new Error('Bad request: offset..');
	}

	return offset;
};

//TODO: sanitize user input for sql injection
const getSort = (sortObj, userScope, allColumnTableNames) => {
	if (!sortObj) {
		return {};
	}

	if (typeof sortObj != 'object') {
		try {
			sortObj = JSON.parse(sortObj);
		} catch (e) {
			console.error(e);
			throw new Error('Bad request: sort.');
		}
	}

	// //should only be allowed to sort by the fields you have access to?
	// const allowedFields = userScope.data || allColumnTableNames;

	// let unauthorizedFields = Object.keys(sortObj).filter(x => !allowedFields.includes(x));
	// if (unauthorizedFields.length != 0) {
	// 	throw new Error('Bad request: sort..');
	// }
	return sortObj;
};

const getJoin = (join) => {
	return join;
};

const generateSQL = ({ accountId, query, userScopes, invokingService, tableName, allowedUserScopes }) => {
	const allowedFieldsForUser = checkAccessField({ query, userScopes, invokingService, tableName, allowedUserScopes });
	//console.log(allowedFieldsForUser);
	const whereFilter = checkWhereFilter({ query, allowedFieldsForUser, invokingService, tableName, accountId });
	const limitVal = getLimit(query.limit);
	const offsetVal = getOffset(query.skip);
	const sortVal = getSort(query.sort);
	const joinVal = getJoin(query.join);

	const select = {
		$columns: allowedFieldsForUser,
		$from: tableName,
		$where: whereFilter,
		$limit: limitVal,
		$offset: offsetVal,
		$orderBy: sortVal,
	};

	if (offsetVal && offsetVal > 10000) {
		//optimize query
		select.$join = {
			t: {
				$innerJoin: {
					$select: {
						$columns: { id: '_id' },
						$from: tableName,
						$where: whereFilter,
						$limit: limitVal,
						$offset: offsetVal,
						$orderBy: sortVal,
					},
					// $using: {
					// 	id: true
					// }
					$on: { 't._id': { $eq: `~~${tableName}.id` } },
				},
			},
		};
		delete select.$limit;
		delete select.$offset;
		delete select.$orderBy;
		delete select.$where;
	}

	console.log(select);

	return { sql: sql.$select(select), limit: limitVal, skip: offsetVal };
};

const generateSQLCount = ({ accountId, query, userScopes, invokingService, tableName, allowedUserScopes }) => {
	const allowedFieldsForUser = checkAccessField({ query, userScopes, invokingService, tableName, allowedUserScopes });
	const whereFilter = checkWhereFilter({ query, allowedFieldsForUser, invokingService, tableName, accountId });

	const select = {
		$columns: [{ cnt: { $count: '*' } }],
		$from: tableName,
		$where: whereFilter,
	};

	return { sql: sql.$select(select) };
};

exports.getData = async ({ accountId, query, userScopes, invokingService, tableName, mgGeneralConn, allowedUserScopes }) => {
	if (userScopes.indexOf('lambda/') == -1) {
		//not issued by a lambda
		delete query.join;
	}
	var sql = generateSQL({
		accountId,
		query,
		userScopes,
		invokingService,
		tableName,
		allowedUserScopes,
	});

	const sqlCount = generateSQLCount({
		accountId,
		query,
		userScopes,
		invokingService,
		tableName,
		allowedUserScopes,
	});

	console.log(sql.sql, sqlCount.sql);

	console.time('getData db call');
	const [resSql, resSqlCount] = await Promise.all([
		mgGeneralConn.query(sql.sql.sql, sql.sql.values),
		mgGeneralConn.query(sqlCount.sql.sql, sqlCount.sql.values),
	]);
	console.timeEnd('getData db call');

	return {
		items: resSql[0],
		paging: {
			has_more: sql.skip + sql.limit < resSqlCount[0][0].cnt,
			limit: sql.limit,
			skip: sql.skip,
			count: resSql[0].length,
			total_count: resSqlCount[0][0].cnt,
		},
	};

	// const MAX_RETRIES = 15; //max time = 1.1minuite = (((2^15)/1000)/60)*2 <- 2 because exponential, 1,2,4,8 = ^4. but cumilativly 1+2+4+8 = 15 = 8 x 2
	// for (let i = 0; i <= MAX_RETRIES; i++) {
	// 	try {
	// 		const data = await getData(q);
	// 		if (!data[0]) {
	// 			throw new Error('No data found');
	// 		}
	// 		return data[0];
	// 	} catch (err) {
	// 		const timeout = Math.pow(2, i);
	// 		console.log('Waiting', timeout, 'ms');
	// 		await wait(timeout);
	// 		console.log('Retrying', err.message, i, customerId, accountId);
	// 	}
	// }
	// console.error('Gave up no data found ', customerId, accountId);
	// return null;
};
