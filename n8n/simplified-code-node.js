const response = $input.first().json;

let text;

try {
  if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = response.candidates[0].content.parts[0].text.trim();
  } else {
    throw new Error('No text in response');
  }
} catch (error) {
  text = "Default script for trending topic. Subscribe for more content!";
}

return {
  json: {
    script_text: text
  }
};