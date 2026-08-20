using System.Text.Json.Serialization;

namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class NmuDepartmentDto
    {
        [JsonPropertyName("facultyCode")]
        public string FacultyCode { get; set; } = string.Empty;

        [JsonPropertyName("facultyName")]
        public string FacultyName { get; set; } = string.Empty;

        [JsonPropertyName("departmentCode")]
        public string DepartmentCode { get; set; } = string.Empty;

        [JsonPropertyName("departmentName")]
        public string DepartmentName { get; set; } = string.Empty;
    }
}
