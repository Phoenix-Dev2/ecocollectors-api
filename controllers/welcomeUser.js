const jwt = require("jsonwebtoken");
const executeQuery = require("../dbHelper");

const WelcomeUserData = async (req, res) => {
  try {
    const token = req.cookies.access_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json("Not authenticated");

    const decodedToken = jwt.verify(token, "jwtkey");
    const userId = decodedToken.id;

    // Define queries
    const queries = {
      stats: `
        SELECT 
          COUNT(*) AS totalRequests,
          SUM(bottles_number) AS totalRecycledBottles,
          AVG(CASE WHEN completed_date IS NOT NULL THEN TIMESTAMPDIFF(SECOND, request_date, completed_date) END) AS avgClosingTime,
          COUNT(CASE WHEN status = 3 THEN 1 END) AS totalCompletedRequests
        FROM user_requests 
        WHERE user_id = ?
      `,
      last3Recyclers: `
        SELECT full_name 
        FROM user_requests 
        WHERE completed_date IS NOT NULL 
        AND user_id = ? 
        ORDER BY completed_date DESC 
        LIMIT 3
      `,
      currentMonthStats: `
        SELECT SUM(bottles_number) AS currentMonthRecycledBottles 
        FROM user_requests 
        WHERE recycler_id IS NOT NULL 
        AND completed_date IS NOT NULL 
        AND user_id = ? 
        AND YEAR(completed_date) = YEAR(NOW()) 
        AND MONTH(completed_date) = MONTH(NOW())
      `,
    };

    // Execute queries concurrently (now only 3 instead of 6)
    const results = await Promise.all([
      executeQuery(queries.stats, [userId]),
      executeQuery(queries.last3Recyclers, [userId]),
      executeQuery(queries.currentMonthStats, [userId]),
    ]);

    // Extract results
    const stats = results[0][0] || {};
    const totalRequests = stats.totalRequests || 0;
    const totalRecycledBottles = stats.totalRecycledBottles || 0;
    const avgClosingTimeInSeconds = stats.avgClosingTime || 0;
    const totalCompletedRequests = stats.totalCompletedRequests || 0;
    
    const last3RecyclersNames = results[1] || [];
    const currentMonthRecycledBottles = results[2][0]?.currentMonthRecycledBottles || 0;

    // Convert avgClosingTime from seconds to days, hours, and minutes
    const avgClosingTimeInMinutes = Math.floor(avgClosingTimeInSeconds / 60);
    const days = Math.floor(avgClosingTimeInMinutes / 1440);
    const hours = Math.floor((avgClosingTimeInMinutes % 1440) / 60);
    const minutes = avgClosingTimeInMinutes % 60;

    res.json({
      totalRequests,
      totalRecycledBottles,
      avgClosingTime: `${days} days ${hours} hours ${minutes} minutes`,
      totalCompletedRequests,
      last3RecyclersNames,
      currentMonthRecycledBottles,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json("Invalid or expired token");
    }
    return res.status(500).json("Internal server error");
  }
};

module.exports = {
  WelcomeUserData: WelcomeUserData,
};
