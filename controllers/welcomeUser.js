const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

const WelcomeUserData = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decodedToken) => {
    if (err) {
      console.error('Error verifying token:', err);
      return res.status(403).json('Token is not valid!');
    }

    const userId = decodedToken.id;

    // Query 1: Count the total requests for the current user
    const getTotalRequestsQuery = `
      SELECT COUNT(*) AS totalRequests
      FROM user_requests
      WHERE user_id = ${userId}
    `;

    // Query 2: Sum the total recycled bottles for the current user
    const getTotalRecycledBottlesQuery = `
      SELECT SUM(bottles_number) AS totalRecycledBottles
      FROM user_requests
      WHERE user_id = ${userId}
    `;

    // Query 3: Calculate the average closing time for the current user's requests
    const getAvgClosingTimeQuery = `
      SELECT AVG(TIMESTAMPDIFF(SECOND, request_date, completed_date)) AS avgClosingTime
      FROM user_requests
      WHERE user_id = ${userId}
      AND completed_date IS NOT NULL
    `;

    // Query 4: Count the total requests completed of the current user
    const getTotalCompletedRequestsQuery = `
      SELECT COUNT(*) AS totalCompletedRequests
      FROM user_requests
      WHERE status = 3 AND user_id = ${userId}
    `;

    // Query 5: Lists the names of the last 3 recyclers that have collected from current user
    const getLast3RecyclersNamesQuery = `
      SELECT full_name
      FROM user_requests
      WHERE completed_date IS NOT NULL
      AND user_id = ${userId}
      ORDER BY completed_date DESC
      LIMIT 3
    `;

    // Query 6: Calculate the number of bottles recycled this current month by the current user
    const getCurrentMonthRecycledBottlesQuery = `
      SELECT SUM(bottles_number) AS currentMonthRecycledBottles
      FROM user_requests
      WHERE recycler_id IS NOT NULL
      AND completed_date IS NOT NULL
      AND user_id = ${userId}
      AND YEAR(completed_date) = YEAR(NOW()) 
      AND MONTH(completed_date) = MONTH(NOW())
    `;

    // Execute Query 1: Get total requests uploaded by current user
    db.query(getTotalRequestsQuery, (err, result) => {
      if (err) {
        console.error('Error executing the query:', err);
        return res.status(500).json('Internal server error');
      }

      const totalRequests = result[0].totalRequests;

      // Execute Query 2: Get total recycled bottles number of current user
      db.query(getTotalRecycledBottlesQuery, (err, result) => {
        if (err) {
          console.error('Error executing the query:', err);
          return res.status(500).json('Internal server error');
        }

        const totalRecycledBottles = result[0].totalRecycledBottles;

        // Execute Query 3: Get the average closing time of requests uploaded by current user
        db.query(getAvgClosingTimeQuery, (err, result3) => {
          if (err) {
            console.error('Error executing the avg closing time query:', err);
            return res.status(500).json('Internal server error');
          }

          // Extract the average closing time in seconds from the query result
          const avgClosingTimeInSeconds = result3[0].avgClosingTime;

          // Calculate the average closing time in days, hours, and minutes
          const avgClosingTimeInDays = Math.floor(
            avgClosingTimeInSeconds / (3600 * 24)
          );
          const avgClosingTimeInHours = Math.floor(
            (avgClosingTimeInSeconds % (3600 * 24)) / 3600
          );
          const avgClosingTimeInMinutes = Math.floor(
            (avgClosingTimeInSeconds % 3600) / 60
          );

          // Execute Query 4: Get total recycled bottles number of current user
          db.query(getTotalCompletedRequestsQuery, (err, result4) => {
            if (err) {
              console.error('Error executing the query:', err);
              return res.status(500).json('Internal server error');
            }

            const totalCompletedRequests = result4[0].totalCompletedRequests;

            // Execute Query 5: Get the names of 3 last recyclers that collected from current user
            db.query(getLast3RecyclersNamesQuery, (err, result5) => {
              if (err) {
                console.error('Error executing the query:', err);
                return res.status(500).json('Internal server error');
              }

              const last3RecyclersNames = result5;

              // Execute Query 6: Get the current month's recycled bottles by current user
              db.query(getCurrentMonthRecycledBottlesQuery, (err, result6) => {
                if (err) {
                  console.error('Error executing the query:', err);
                  return res.status(500).json('Internal server error');
                }

                const currentMonthRecycledBottles =
                  result6[0].currentMonthRecycledBottles;

                return res.json({
                  totalRequests,
                  totalRecycledBottles,
                  avgClosingTime: {
                    days: avgClosingTimeInDays,
                    hours: avgClosingTimeInHours,
                    minutes: avgClosingTimeInMinutes,
                  },
                  totalCompletedRequests,
                  last3RecyclersNames,
                  currentMonthRecycledBottles,
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
  WelcomeUserData: WelcomeUserData,
};
