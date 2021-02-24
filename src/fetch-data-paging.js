// exports.getData = async ({ accountId, query, userScopes, invokingService, tableName, mgGeneralConn, allowedUserScopes }) => {
// 	if (userScopes.indexOf('lambda/') == -1) {
// 		//not issued by a lambda
// 		delete query.join;
// 	}
// 	var sql = generateSQL({
// 		accountId,
// 		query,
// 		userScopes,
// 		invokingService,
// 		tableName,
// 		allowedUserScopes
// 	});

// 	const sqlCount = generateSQLCount({
// 		accountId,
// 		query,
// 		userScopes,
// 		invokingService,
// 		tableName,
// 		allowedUserScopes
// 	});

// 	console.log(sql.sql, sqlCount.sql);

// 	console.time('getData db call');
// 	const [resSql, resSqlCount] = await Promise.all([mgGeneralConn.query(sql.sql.sql, sql.sql.values), mgGeneralConn.query(sqlCount.sql.sql, sqlCount.sql.values)]);
// 	console.timeEnd('getData db call');

// 	return {
// 		items: resSql[0],
// 		paging: {
// 			has_more: sql.skip + sql.limit < resSqlCount[0][0].cnt,
// 			limit: sql.limit,
// 			skip: sql.skip,
// 			count: resSql[0].length,
// 			total_count: resSqlCount[0][0].cnt
// 		}
// 	};
// };