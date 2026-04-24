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
      stats: `
        SELECT 
          COUNT(CASE WHEN recycler_id = ? THEN 1 END) AS totalRequestsPickedUp,
          SUM(CASE WHEN recycler_id = ? THEN bottles_number ELSE 0 END) AS totalRecycledBottles,
          AVG(CASE WHEN recycler_id = ? AND completed_date IS NOT NULL THEN TIMESTAMPDIFF(SECOND, request_date, completed_date) END) AS avgClosingTime,
          SUM(CASE WHEN recycler_id = ? AND completed_date IS NOT NULL AND YEAR(completed_date) = YEAR(NOW()) AND MONTH(completed_date) = MONTH(NOW()) THEN bottles_number ELSE 0 END) AS currentMonthRecycledBottles,
          (SELECT COUNT(*) FROM user_requests WHERE status = 1) AS openRequests
        FROM user_requests
      `,
      last3Users: `
        SELECT full_name 
        FROM user_requests 
        WHERE completed_date IS NOT NULL 
        AND recycler_id = ? 
        ORDER BY completed_date DESC 
        LIMIT 3
      `,
    };

    // Execute queries concurrently (now only 2 instead of 6)
    const results = await Promise.all([
      executeQuery(queries.stats, [userId, userId, userId, userId]),
      executeQuery(queries.last3Users, [userId])
    ]);

    // Extract results
    const stats = results[0][0] || {};
    const totalRequestsPickedUp = stats.totalRequestsPickedUp || 0;
    const totalRecycledBottles = stats.totalRecycledBottles || 0;
    const avgClosingTimeInSeconds = stats.avgClosingTime || 0;
    const currentMonthRecycledBottles = stats.currentMonthRecycledBottles || 0;
    const openRequests = stats.openRequests || 0;
    
    const last3UsersNames = results[1] || [];

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
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json("Invalid or expired token");
    }
    return res.status(500).json("Internal server error");
  }
};

module.exports = {
  WelcomeRecyclerData: WelcomeRecyclerData,
};
