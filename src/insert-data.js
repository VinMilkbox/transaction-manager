const knex = require('knex')({
	client: 'mysql',
	connection: {
		host: '127.0.0.1',
		user: 'your_database_user',
		password: 'your_database_password',
		database: 'myapp_test',
	},
});

const aggregateVersionTableName = process.env.AGGREGATE_VERSION_TABLE_NAME || 'aggregate_versions';
const eventStoreTableName = process.env.READ_MODEL_EVENT_STORE_TABLE_NAME || 'event_store_rm';

exports.upsertAggregateVersionSQL = (versionInfo) => {
	if (versionInfo.isNew) {
		let fieldRows = {
			aggregate_id: versionInfo.aggregateId,
			latest_version: versionInfo.version,
			created_at: new Date().getTime(),
			updated_at: new Date().getTime(),
		};
		return knex(aggregateVersionTableName).insert(fieldRows);
	}

	let fieldRows = {
		latest_version: versionInfo.version,
		updated_at: new Date().getTime(),
	};

	return knex(aggregateVersionTableName).where('aggregate_id', '=', versionInfo.aggregateId).update(fieldRows);
};

exports.insertMysqlEventStore = (events) => {
	const fieldRows = events.map((m) => ({
		payload: JSON.stringify(m.payload),
		aggregate_id: m.aggregateId,
		sequence_id: m.sequenceId,
		created_at: m.createdAt,
		inserted_at_rm: new Date().getTime(),
		inserted_at_wm: m.insertedAt,
		aggregate_type: m.aggregateType,
		event_name: m.eventName,
		account_id: m.accountId,
		event_hash: m.eventHash,
	}));
	return knex(eventStoreTableName).insert(fieldRows);
};
