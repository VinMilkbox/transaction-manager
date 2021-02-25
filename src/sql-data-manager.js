const SQLBuilder = require('json-sql-builder2');
const sql = new SQLBuilder('MySQL');

const aggregateVersionTableName = process.env.AGGREGATE_VERSION_TABLE_NAME || 'aggregate_versions';
const eventStoreTableName = process.env.READ_MODEL_EVENT_STORE_TABLE_NAME || 'event_store_rm';

/** INSERT METHOD */
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

	return sql.$insert({
		$table: eventStoreTableName,
		$columns: {
			payload: true,
			aggregate_id: true,
			sequence_id: true,
			created_at: true,
			inserted_at_rm: true,
			inserted_at_wm: true,
			aggregate_type: true,
			event_name: true,
			account_id: true,
			event_hash: true,
		},
		$values: Object.values(fieldRows),
	});
};

/** INSERT ? UPDATE METHOD */
exports.upsertAggregateVersionSQL = (versionInfo) => {
	if (versionInfo.isNew) {
		let fieldRows = {
			aggregate_id: versionInfo.aggregateId,
			latest_version: versionInfo.version,
			created_at: new Date().getTime(),
			updated_at: new Date().getTime(),
		};
		return sql.$insert({
			$table: aggregateVersionTableName,
			$columns: {
				aggregate_id: true,
				latest_version: true,
				created_at: true,
				updated_at: true,
			},
			$values: Object.values(fieldRows),
		});
	} else {
		return sql.$update({
			$table: aggregateVersionTableName,
			$set: {
				latest_version: versionInfo.version,
				updated_at: new Date().getTime(),
			},
			$where: {
				aggregate_id: $eq(versionInfo.aggregateId),
			},
		});
	}
};

/** DELETE METHOD */
exports.deleteAggregateVersionSQL = (versionInfo) => {
	return sql.$update({
		$from: aggregateVersionTableName,
		$where: {
			aggregate_id: $eq(versionInfo.aggregateId),
		},
	});
};
