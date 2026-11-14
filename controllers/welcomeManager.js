const executeQuery = require("../dbHelper");

const WelcomeManagerData = async (req, res, next) => {
  try {
    // Define queries
    const queries = {
      stats: `
        SELECT 
          COUNT(CASE WHEN recycler_id IS NOT NULL THEN 1 END) AS totalPickedUpRequests,
          SUM(CASE WHEN recycler_id IS NOT NULL THEN bottles_number ELSE 0 END) AS totalRecycledBottles,
          AVG(CASE WHEN recycler_id IS NOT NULL AND completed_date IS NOT NULL THEN TIMESTAMPDIFF(SECOND, request_date, completed_date) END) AS avgClosingTime,
          SUM(CASE WHEN recycler_id IS NOT NULL AND completed_date IS NOT NULL AND YEAR(completed_date) = YEAR(NOW()) AND MONTH(completed_date) = MONTH(NOW()) THEN bottles_number ELSE 0 END) AS currentMonthCollectedBottles,
          (SELECT COUNT(*) FROM markers WHERE active = 1) AS activeBinsCount
        FROM user_requests
      `,
      last3Completed: `
        SELECT full_name, req_address, bottles_number 
        FROM user_requests 
        WHERE completed_date IS NOT NULL 
        ORDER BY completed_date DESC 
        LIMIT 3
      `,
    };

    // Execute queries concurrently (now only 2 instead of 6)
    const results = await Promise.all([
      executeQuery(queries.stats),
      executeQuery(queries.last3Completed)
    ]);

    // Extract results
    const stats = results[0][0] || {};
    const totalPickedUpRequests = stats.totalPickedUpRequests || 0;
    const totalRecycledBottles = stats.totalRecycledBottles || 0;
    const avgClosingTimeInSeconds = stats.avgClosingTime || 0;
    const currentMonthCollectedBottles = stats.currentMonthCollectedBottles || 0;
    const activeBinsCount = stats.activeBinsCount || 0;
    
    const last3CompletedRequests = results[1] || [];

    // Convert avgClosingTime from seconds to days, hours, and minutes
    const avgClosingTimeInMinutes = Math.floor(avgClosingTimeInSeconds / 60);
    const days = Math.floor(avgClosingTimeInMinutes / 1440);
    const hours = Math.floor((avgClosingTimeInMinutes % 1440) / 60);
    const minutes = avgClosingTimeInMinutes % 60;

    res.json({
      totalPickedUpRequests,
      totalRecycledBottles,
      currentMonthCollectedBottles,
      avgClosingTime: `${days} days ${hours} hours ${minutes} minutes`,
      last3CompletedRequests,
      activeBinsCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  WelcomeManagerData: WelcomeManagerData,
};
