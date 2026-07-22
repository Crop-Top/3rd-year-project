using System.Text.Json.Serialization;
using System.Net.Http.Json;

public class CaptchaService
{
    private readonly HttpClient _httpClient;
    // Replace with your actual Cloudflare Turnstile Secret Key (or fetch via IConfiguration)
    private const string TurnstileSecretKey = "0x4AAAAAAD7NmZTfLhaVUnGVn0VPUgY-v5s";

    public CaptchaService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<bool> VerifyCaptchaAsync(string? captchaToken)
    {
        if (string.IsNullOrWhiteSpace(captchaToken))
        {
            Console.WriteLine("[Turnstile Verification] Token was null or empty.");
            return false;
        }

        var values = new Dictionary<string, string>
        {
            { "secret", TurnstileSecretKey },
            { "response", captchaToken }
        };

        try
        {
            var response = await _httpClient.PostAsync(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                new FormUrlEncodedContent(values)
            );

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[Turnstile Verification] HTTP Status Failed: {response.StatusCode}");
                return false;
            }

            var result = await response.Content.ReadFromJsonAsync<TurnstileResponse>();

            if (result == null || !result.Success)
            {
                var errorList = result?.ErrorCodes != null ? string.Join(", ", result.ErrorCodes) : "None provided";
                Console.WriteLine($"[Turnstile Verification FAILED] Errors: {errorList} | Hostname: {result?.Hostname}");
                return false;
            }

            Console.WriteLine("[Turnstile Verification PASSED] Token successfully validated.");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Turnstile Verification EXCEPTION] {ex.Message}");
            return false;
        }
    }

    private class TurnstileResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("error-codes")]
        public List<string> ErrorCodes { get; set; } = new();

        [JsonPropertyName("hostname")]
        public string? Hostname { get; set; }
    }
}