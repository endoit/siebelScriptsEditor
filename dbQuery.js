const oracledb = require('oracledb');
const config = require ('./config.js');

// const fetch = require('node-fetch');
oracledb.outFormat = oracledb.OBJECT;
oracledb.initOracleClient({configDir: 'C:\\ORACLE\\instantclient-basic-windows'});

console.log(config.DBConnection);



async function dbQuery (query) {
  try {
    // Exectue query
    var connection = await oracledb.getConnection(config.DBConnection);
    console.log('connected to database');
    //const query = "SELECT * FROM SIEBEL.S_SERVICE WHERE CREATED < SYSDATE";
    var result = await connection.execute(query);
  } catch (err) {
    // send error message
    return err.message
  } finally {
    if (connection) {
      try {
        // Always close connections
        await connection.close()
        console.log('close connection success')
      } catch (err) {
        console.error(err.message)
      }
    }
    if (result.rows.length == 0) {
      // query return zero Template
      console.log('no new template')
    } else {
      console.log('-------------------------')
      console.log(result)
      // send all Template
      //return res.send(result.rows)
    }
  }
}

exports.dbQuery = dbQuery;