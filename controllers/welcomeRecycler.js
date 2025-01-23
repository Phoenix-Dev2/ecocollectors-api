const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

const WelcomeRecyclerData = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decodedToken) => {
    if (err) {
      console.error('Error verifying token:', err);
      return res.status(403).json('Token is not valid!');
    }

    const userId = decodedToken.id;

    // Query 1: Count the total requests picked up by the current recycler
    const getTotalRequestsPickedUpQuery = `
      SELECT COUNT(*) AS totalRequestsPickedUp
      FROM user_requests
      WHERE recycler_id = ${userId}
    `;

    // Query 2: Calculate the total recycled bottles by the current recycler
    const getTotalRecycledBottlesQuery = `
      SELECT SUM(bottles_number) AS totalRecycledBottles
      FROM user_requests
      WHERE recycler_id = ${userId}
    `;

    // Query 3: Calculate the average closing time for the current recycler's requests picked up
    const getAvgClosingTimeQuery = `
      SELECT AVG(TIMESTAMPDIFF(SECOND, request_date, completed_date)) AS avgClosingTime
      FROM user_requests
      WHERE recycler_id = ${userId} AND completed_date IS NOT NULL
    `;

    // Query 4: Calculate the number of bottles picked up this current month by the current recycler
    const getCurrentMonthRecycledBottlesQuery = `
      SELECT SUM(bottles_number) AS currentMonthRecycledBottles
      FROM user_requests
      WHERE recycler_id IS NOT NULL
      AND completed_date IS NOT NULL
      AND recycler_id = ${userId}
      AND YEAR(completed_date) = YEAR(NOW()) 
      AND MONTH(completed_date) = MONTH(NOW())
    `;

    // Query 5: Lists the names of the last 3 users that the current recycler have collected from
    const getLast3UsersNamesQuery = `
      SELECT full_name
      FROM user_requests
      WHERE completed_date IS NOT NULL
      AND recycler_id = ${userId}
      ORDER BY completed_date DESC
      LIMIT 3
    `;

    // Query 6: Count the open requests for the current recycler to pick up
    const getOpenRequestsQuery = `
      SELECT COUNT(*) AS openRequests
      FROM user_requests
      WHERE status = 1
    `;

    // Execute Query 1: Get total requests uploaded by current recycler
    db.query(getTotalRequestsPickedUpQuery, (err1, result1) => {
      if (err1) {
        console.error(
          'Error executing the total requests picked up query:',
          err1
        );
        return res.status(500).json('Internal server error');
      }
      const totalRequestsPickedUp = result1[0].totalRequestsPickedUp;

      // Execute Query 2: Get total recycled bottles number of current recycler
      db.query(getTotalRecycledBottlesQuery, (err2, result2) => {
        if (err2) {
          console.error(
            'Error executing the total recycled bottles query:',
            err2
          );
          return res.status(500).json('Internal server error');
        }
        const totalRecycledBottles = result2[0].totalRecycledBottles;

        // Execute Query 3: Get the average closing time of requests uploaded by current recycler
        db.query(getAvgClosingTimeQuery, (err3, result3) => {
          if (err3) {
            console.error('Error executing the avg closing time query:', err3);
            return res.status(500).json('Internal server error');
          }
          const avgClosingTimeInSeconds = result3[0].avgClosingTime;
          const avgClosingTimeInMinutes = Math.floor(
            avgClosingTimeInSeconds / 60
          );
          const days = Math.floor(avgClosingTimeInMinutes / 1440);
          const hours = Math.floor((avgClosingTimeInMinutes % 1440) / 60);
          const minutes = avgClosingTimeInMinutes % 60;
          const avgClosingTime = `${days} days ${hours} hours ${minutes} minutes`;

          // Execute Query 4: Get the current month's recycled bottles by current recycler
          db.query(getCurrentMonthRecycledBottlesQuery, (err, result4) => {
            if (err) {
              console.error('Error executing the query:', err);
              return res.status(500).json('Internal server error');
            }

            const currentMonthRecycledBottles =
              result4[0].currentMonthRecycledBottles;

            // Execute Query 5: Get the names of the last 3 users that the current recycler have collected from
            db.query(getLast3UsersNamesQuery, (err, result5) => {
              if (err) {
                console.error('Error executing the query:', err);
                return res.status(500).json('Internal server error');
              }

              const last3UsersNames = result5;

              // Execute Query 6: Get the open requests for the current recycler to pick up
              db.query(getOpenRequestsQuery, (err, result6) => {
                if (err) {
                  console.error('Error executing the query:', err);
                  return res.status(500).json('Internal server error');
                }

                const openRequests = result6[0].openRequests;

                res.json({
                  totalRequestsPickedUp,
                  totalRecycledBottles,
                  avgClosingTime,
                  currentMonthRecycledBottles,
                  last3UsersNames,
                  openRequests,
                });
              });
            });
          });
        });
      });
    });
  });
};

module.exports = {
  WelcomeRecyclerData: WelcomeRecyclerData,
};
