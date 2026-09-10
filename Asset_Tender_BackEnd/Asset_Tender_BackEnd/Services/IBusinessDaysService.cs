namespace Asset_Tender_BackEnd.Services
{
    public interface IBusinessDaysService
    {
        DateTime AddBusinessDays(DateTime startDate, int businessDays);
    }
}
