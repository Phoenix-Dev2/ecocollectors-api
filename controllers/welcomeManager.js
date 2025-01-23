const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

const WelcomeManagerData = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decodedToken) => {
    if (err) {
      console.error('Error verifying token:', err);
      return res.status(403).json('Token is not valid!');
    }

    // Query 1: Count the total requests picked up by recyclers
    const getTotalPickedUpRequestsQuery = `
      SELECT COUNT(*) AS totalPickedUpRequests
      FROM user_requests
      WHERE recycler_id IS NOT NULL
    `;

    // Query 2: Sum the total recycled bottles for all recyclers
    const getTotalRecycledBottlesQuery = `
      SELECT SUM(bottles_number) AS totalRecycledBottles
      FROM user_requests
      WHERE recycler_id IS NOT NULL
    `;

    // Query 3: Calculate the average closing time for all recyclers' requests
    const getAvgClosingTimeQuery = `
      SELECT AVG(TIMESTAMPDIFF(SECOND, request_date, completed_date)) AS avgClosingTime
      FROM user_requests
      WHERE recycler_id IS NOT NULL
      AND completed_date IS NOT NULL
    `;

    // Query 4: Calculate the number of bottles collected by recyclers at this current month
    const getCurrentMonthCollectedBottlesQuery = `
      SELECT SUM(bottles_number) AS currentMonthCollectedBottles
      FROM user_requests
      WHERE recycler_id IS NOT NULL
      AND completed_date IS NOT NULL
      AND YEAR(completed_date) = YEAR(NOW()) 
      AND MONTH(completed_date) = MONTH(NOW())
    `;

    // Query 5: Get the last 3 completed requests with recycler info
    const getLast3CompletedRequestsQuery = `
      SELECT full_name, req_address, bottles_number
      FROM user_requests
      WHERE completed_date IS NOT NULL
      ORDER BY completed_date DESC
      LIMIT 3
    `;

    // Query 6: Count the number of active bins in the 'markers' table
    const getActiveBinsCountQuery = `
      SELECT COUNT(*) AS activeBinsCount
      FROM markers
      WHERE active = 1
    `;
    // Execute Query 1: Total requests picked up
    db.query(getTotalPickedUpRequestsQuery, (err, result1) => {
      if (err) {
        console.error(
          'Error executing the total picked up requests query:',
          err
        );
        return res.status(500).json('Internal server error');
      }

      const totalPickedUpRequests = result1[0].totalPickedUpRequests;

      // Execute Query 2: Total recycled bottles
      db.query(getTotalRecycledBottlesQuery, (err, result2) => {
        if (err) {
          console.error(
            'Error executing the total recycled bottles query:',
            err
          );
          return res.status(500).json('Internal server error');
        }

        const totalRecycledBottles = result2[0].totalRecycledBottles;

        // Execute Query 3: Average Closing Time
        db.query(getAvgClosingTimeQuery, (err, result3) => {
          if (err) {
            console.error('Error executing the avg closing time query:', err);
            return res.status(500).json('Internal server error');
          }

          const avgClosingTimeInSeconds = result3[0].avgClosingTime;

          const avgClosingTimeInDays = Math.floor(
            avgClosingTimeInSeconds / (3600 * 24)
          );
          const avgClosingTimeInHours = Math.floor(
            (avgClosingTimeInSeconds % (3600 * 24)) / 3600
          );
          const avgClosingTimeInMinutes = Math.floor(
            (avgClosingTimeInSeconds % 3600) / 60
          );

          // Execute Query 4: Current month collected bottles
          db.query(getCurrentMonthCollectedBottlesQuery, (err, result4) => {
            if (err) {
              console.error(
                'Error executing the current month collected bottles query:',
                err
              );
              return res.status(500).json('Internal server error');
            }

            const currentMonthCollectedBottles =
              result4[0].currentMonthCollectedBottles;

            // Execute Query 5: Last 3 requests completed info
            db.query(getLast3CompletedRequestsQuery, (err, result5) => {
              if (err) {
                console.error(
                  'Error executing the last 3 completed requests query:',
                  err
                );
                return res.status(500).json('Internal server error');
              }

              const last3CompletedRequests = result5;

              // Execute Query 6: Active bins count
              db.query(getActiveBinsCountQuery, (err, result6) => {
                if (err) {
                  console.error(
                    'Error executing the active bins count query:',
                    err
                  );
                  return res.status(500).json('Internal server error');
                }

                const activeBinsCount = result6[0].activeBinsCount;

                return res.json({
                  totalPickedUpRequests,
                  totalRecycledBottles,
                  currentMonthCollectedBottles,
                  avgClosingTime: {
                    days: avgClosingTimeInDays,
                    hours: avgClosingTimeInHours,
                    minutes: avgClosingTimeInMinutes,
                  },
                  last3CompletedRequests,
                  activeBinsCount,
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
  WelcomeManagerData: WelcomeManagerData,
};
