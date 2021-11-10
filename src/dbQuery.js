const oracledb = require('oracledb');
const config = require ('../config.js');

oracledb.outFormat = oracledb.OBJECT;
oracledb.fetchAsString = [ oracledb.CLOB ];
oracledb.initOracleClient({ configDir: config.DBConnection.configDir });

async function dbQuery(query) {
  try {
    // Exectue query
    var connection = await oracledb.getConnection(config.DBConnection);
    console.log('connected to database');
    //const query = "SELECT * FROM SIEBEL.S_SERVICE WHERE CREATED > SYSDATE-100";
    var result = await connection.execute(query);
  } catch (err) {
    // send error message
    console.log(err.message);
    return err.message;
  } finally {
    if (connection) {
      try {
        // Always close connections
        await connection.close();
        console.log('close connection success');
      } catch (err) {
        console.error(err.message);
      }
    }
    if (result) {
      return result;
    } else {
      console.log("The query returned without result set");
      return [];
    }
  }
}

exports.dbQuery = dbQuery;