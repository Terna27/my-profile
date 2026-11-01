package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strings"
)

type StringArray []string

func (s StringArray) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}

	data, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}

	return string(data), nil
}

func (s *StringArray) Scan(value interface{}) error {
	if value == nil {
		*s = []string{}
		return nil
	}

	var data []byte

	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("unsupported StringArray value type: %T", value)
	}

	if len(data) == 0 {
		*s = []string{}
		return nil
	}

	return json.Unmarshal(data, s)
}

type Portfolio struct {
	Profile      Profile
	Statistics   []Statistic
	Skills       []Skill
	Services     []ServiceOffering
	Education    []EducationEntry
	Certificates []Certificate
	Projects     []Project
	Contact      ContactInfo
	SocialLinks  []SocialLink
	Photos       []Photo
}

type Profile struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"not null" json:"name"`
	Title        string `json:"title"`
	Bio          string `gorm:"type:text" json:"bio"`
	Location     string `json:"location"`
	ProfileImage string `json:"profile_image"`
	Availability string `json:"availability"`
	CreatedAt    int64  `json:"created_at"`
	UpdatedAt    int64  `json:"updated_at"`
}

type Statistic struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Label     string `gorm:"not null" json:"label"`
	Value     string `gorm:"not null" json:"value"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type Skill struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Name      string `gorm:"not null" json:"name"`
	Category  string `json:"category"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type ServiceOffering struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Title       string `gorm:"not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`
	Icon        string `json:"icon"`
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

type EducationEntry struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Institution string `gorm:"not null" json:"institution"`
	Degree      string `json:"degree"`
	Field       string `json:"field"`
	StartYear   int    `json:"start_year"`
	EndYear     int    `json:"end_year"`
	Description string `gorm:"type:text" json:"description"`
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

type Certificate struct {
	ID              uint   `gorm:"primaryKey" json:"id"`
	Title           string `gorm:"not null" json:"title"`
	Issuer          string `json:"issuer"`
	IssueDate       string `json:"issue_date"`
	CredentialID    string `json:"credential_id"`
	Description     string `gorm:"type:text" json:"description"`
	Image           string `json:"image"`
	VerificationURL string `json:"verification_url"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
}

type Project struct {
	ID           uint        `gorm:"primaryKey" json:"id"`
	Name         string      `json:"name"`
	Description  string      `gorm:"type:text" json:"description"`
	Image        string      `json:"image"`
	URL          string      `json:"url"`
	GitHub       string      `json:"github"`
	Technologies StringArray `gorm:"type:jsonb" json:"technologies"`
	CreatedAt    int64       `json:"created_at"`
	UpdatedAt    int64       `json:"updated_at"`
}

type ContactInfo struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Location  string `json:"location"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// CleanEmail strips markdown formatting like [addr](mailto:addr) from contact email.
func (c ContactInfo) CleanEmail() string {
	raw := strings.TrimSpace(c.Email)
	if strings.HasPrefix(raw, "[") && strings.Contains(raw, "]") {
		idx := strings.Index(raw, "]")
		return strings.TrimSpace(raw[1:idx])
	}
	return raw
}

type SocialLink struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Platform  string `gorm:"not null" json:"platform"`
	URL       string `json:"url"`
	Username  string `json:"username"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type Photo struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	URL          string `gorm:"not null" json:"url"`
	Caption      string `json:"caption"`
	DisplayOrder int    `gorm:"default:0" json:"display_order"`
	CreatedAt    int64  `json:"created_at"`
	UpdatedAt    int64  `json:"updated_at"`
}

// SkillCategoryGroup groups skills into logical presentation buckets.
type SkillCategoryGroup struct {
	Category    string
	Description string
	Skills      []Skill
}

// CategorizedSkills groups the existing skills into sensible categories:
// Backend, AI & Automation / Security, Frontend & Full-Stack, Tools & Deployment.
func (p Portfolio) CategorizedSkills() []SkillCategoryGroup {
	categoryMap := make(map[string][]Skill)
	var categoryOrder []string

	canonicalCategory := func(cat string) string {
		lower := strings.ToLower(strings.TrimSpace(cat))
		switch {
		case strings.Contains(lower, "backend") || strings.Contains(lower, "database") || strings.Contains(lower, "architecture") || strings.Contains(lower, "scripting"):
			return "Backend & Systems"
		case strings.Contains(lower, "cyber") || strings.Contains(lower, "penetration") || strings.Contains(lower, "threat") || strings.Contains(lower, "security") || strings.Contains(lower, "ai") || strings.Contains(lower, "automation"):
			return "AI, Automation & Security"
		case strings.Contains(lower, "front") || strings.Contains(lower, "react") || strings.Contains(lower, "css") || strings.Contains(lower, "full-stack"):
			return "Frontend & Full-Stack"
		case strings.Contains(lower, "tool") || strings.Contains(lower, "git") || strings.Contains(lower, "deploy") || strings.Contains(lower, "devops"):
			return "Tools & Deployment"
		default:
			if cat != "" {
				return cat
			}
			return "Core Technologies"
		}
	}

	for _, s := range p.Skills {
		cat := canonicalCategory(s.Category)
		if _, exists := categoryMap[cat]; !exists {
			categoryOrder = append(categoryOrder, cat)
		}
		categoryMap[cat] = append(categoryMap[cat], s)
	}

	// Defined presentation order
	preferredOrder := []struct {
		Name string
		Desc string
	}{
		{"Backend & Systems", "High-performance services, RESTful APIs, relational databases, and microservices."},
		{"AI, Automation & Security", "Threat modeling, web app penetration testing, AI integrations, and automation workflows."},
		{"Frontend & Full-Stack", "Modern user interfaces, reactive components, responsive design, and state management."},
		{"Tools & Deployment", "Version control, Linux environments, build pipelines, and production workflows."},
	}

	var result []SkillCategoryGroup
	seen := make(map[string]bool)

	for _, pref := range preferredOrder {
		if skills, ok := categoryMap[pref.Name]; ok && len(skills) > 0 {
			result = append(result, SkillCategoryGroup{
				Category:    pref.Name,
				Description: pref.Desc,
				Skills:      skills,
			})
			seen[pref.Name] = true
		}
	}

	for _, cat := range categoryOrder {
		if !seen[cat] && len(categoryMap[cat]) > 0 {
			result = append(result, SkillCategoryGroup{
				Category:    cat,
				Description: "Specialized frameworks and core tools.",
				Skills:      categoryMap[cat],
			})
		}
	}

	return result
}

// DefaultPhotos returns the 5 bundled photos for the hero slideshow.
func DefaultPhotos() []Photo {
	return []Photo{
		{URL: "/static/images/profilee.png", Caption: "Terna Peter Kpensalen — Portrait 1", DisplayOrder: 1},
		{URL: "/static/images/portrait-classic.webp", Caption: "Terna Peter Kpensalen — Portrait 2", DisplayOrder: 2},
		{URL: "/static/images/portrait-suit.webp", Caption: "Terna Peter Kpensalen — Portrait 3", DisplayOrder: 3},
		{URL: "/static/images/portrait-casual.webp", Caption: "Terna Peter Kpensalen — Portrait 4", DisplayOrder: 4},
		{URL: "/static/images/portrait-relaxed.webp", Caption: "Terna Peter Kpensalen — Portrait 5", DisplayOrder: 5},
	}
}
