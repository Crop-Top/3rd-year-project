namespace Asset_Tender_BackEnd.Services
{
    public class BusinessDaysService : IBusinessDaysService
    {
        // Fixed public holidays & statutory dates for South Africa (adjust dynamically if needed)
        private static readonly HashSet<(int Month, int Day)> FixedHolidays = new()
    {
        (1, 1),   // New Year's Day
        (3, 21),  // Human Rights Day
        (4, 27),  // Freedom Day
        (5, 1),   // Workers' Day
        (6, 16),  // Youth Day
        (8, 9),   // National Women's Day
        (9, 24),  // Heritage Day
        (12, 16), // Day of Reconciliation
        (12, 25), // Christmas Day
        (12, 26)  // Day of Goodwill
    };

        public DateTime AddBusinessDays(DateTime startDate, int businessDays)
        {
            DateTime current = startDate;
            int added = 0;

            while (added < businessDays)
            {
                current = current.AddDays(1);

                if (IsBusinessDay(current))
                {
                    added++;
                }
            }

            return current;
        }

        private bool IsBusinessDay(DateTime date)
        {
            if (date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday)
                return false;

            if (FixedHolidays.Contains((date.Month, date.Day)))
                return false;

            return true;
        }
    }
}
