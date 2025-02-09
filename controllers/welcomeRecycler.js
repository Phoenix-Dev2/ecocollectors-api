const jwt = require("jsonwebtoken");
const executeQuery = require("../dbHelper");

const WelcomeRecyclerData = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decodedToken = jwt.verify(token, "jwtkey");
    const userId = decodedToken.id;

    // Define queries
    const queries = {
      totalRequestsPickedUp: `
        SELECT COUNT(*) AS totalRequestsPickedUp 
        FROM user_requests 
        WHERE recycler_id = ?
      `,
      totalRecycledBottles: `
        SELECT SUM(bottles_number) AS totalRecycledBottles 
        FROM user_requests 
        WHERE recycler_id = ?
      `,
      avgClosingTime: `
        SELECT AVG(TIMESTAMPDIFF(SECOND, request_date, completed_date)) AS avgClosingTime 
        FROM user_requests 
        WHERE recycler_id = ? 
        AND completed_date IS NOT NULL
      `,
      currentMonthRecycledBottles: `
        SELECT SUM(bottles_number) AS currentMonthRecycledBottles 
        FROM user_requests 
        WHERE recycler_id = ? 
        AND completed_date IS NOT NULL 
        AND YEAR(completed_date) = YEAR(NOW()) 
        AND MONTH(completed_date) = MONTH(NOW())
      `,
      last3UsersNames: `
        SELECT full_name 
        FROM user_requests 
        WHERE completed_date IS NOT NULL 
        AND recycler_id = ? 
        ORDER BY completed_date DESC 
        LIMIT 3
      `,
      openRequests: `
        SELECT COUNT(*) AS openRequests 
        FROM user_requests 
        WHERE status = 1
      `,
    };

    // Execute all queries concurrently
    const results = await Promise.all(
      Object.values(queries).map((query) => executeQuery(query, [userId]))
    );

    // Extract results
    const totalRequestsPickedUp = results[0][0]?.totalRequestsPickedUp || 0;
    const totalRecycledBottles = results[1][0]?.totalRecycledBottles || 0;
    const avgClosingTimeInSeconds = results[2][0]?.avgClosingTime || 0;
    const currentMonthRecycledBottles =
      results[3][0]?.currentMonthRecycledBottles || 0;
    const last3UsersNames = results[4] || [];
    const openRequests = results[5][0]?.openRequests || 0;

    // Convert avgClosingTime from seconds to days, hours, and minutes
    const avgClosingTimeInMinutes = Math.floor(avgClosingTimeInSeconds / 60);
    const days = Math.floor(avgClosingTimeInMinutes / 1440);
    const hours = Math.floor((avgClosingTimeInMinutes % 1440) / 60);
    const minutes = avgClosingTimeInMinutes % 60;

    res.json({
      totalRequestsPickedUp,
      totalRecycledBottles,
      avgClosingTime: `${days} days ${hours} hours ${minutes} minutes`,
      currentMonthRecycledBottles,
      last3UsersNames,
      openRequests,
    });
  } catch (error) {
    console.error("Error fetching recycler data:", error);
    return res.status(500).json("Internal server error");
  }
};

module.exports = {
  WelcomeRecyclerData: WelcomeRecyclerData,
};
