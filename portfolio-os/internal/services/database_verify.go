package services

import (
	"fmt"
	"log"

	"portfolio-os/internal/models"

	"gorm.io/gorm"
)

func VerifyPortfolioData(db *gorm.DB) error {
	var profileCount int64
	var statisticsCount int64
	var skillsCount int64
	var servicesCount int64
	var educationCount int64
	var certificatesCount int64
	var projectsCount int64
	var contactsCount int64
	var socialLinksCount int64
	var photosCount int64

	if err := db.Model(&models.Profile{}).Count(&profileCount).Error; err != nil {
		return fmt.Errorf("failed to count profiles: %w", err)
	}

	if err := db.Model(&models.Statistic{}).Count(&statisticsCount).Error; err != nil {
		return fmt.Errorf("failed to count statistics: %w", err)
	}

	if err := db.Model(&models.Skill{}).Count(&skillsCount).Error; err != nil {
		return fmt.Errorf("failed to count skills: %w", err)
	}

	if err := db.Model(&models.ServiceOffering{}).Count(&servicesCount).Error; err != nil {
		return fmt.Errorf("failed to count services: %w", err)
	}

	if err := db.Model(&models.EducationEntry{}).Count(&educationCount).Error; err != nil {
		return fmt.Errorf("failed to count education: %w", err)
	}

	if err := db.Model(&models.Certificate{}).Count(&certificatesCount).Error; err != nil {
		return fmt.Errorf("failed to count certificates: %w", err)
	}

	if err := db.Model(&models.Project{}).Count(&projectsCount).Error; err != nil {
		return fmt.Errorf("failed to count projects: %w", err)
	}

	if err := db.Model(&models.ContactInfo{}).Count(&contactsCount).Error; err != nil {
		return fmt.Errorf("failed to count contacts: %w", err)
	}

	if err := db.Model(&models.SocialLink{}).Count(&socialLinksCount).Error; err != nil {
		return fmt.Errorf("failed to count social links: %w", err)
	}

	if err := db.Model(&models.Photo{}).Count(&photosCount).Error; err != nil {
		return fmt.Errorf("failed to count photos: %w", err)
	}

	log.Println("Portfolio database verification:")
	log.Printf("Profiles: %d", profileCount)
	log.Printf("Statistics: %d", statisticsCount)
	log.Printf("Skills: %d", skillsCount)
	log.Printf("Services: %d", servicesCount)
	log.Printf("Education: %d", educationCount)
	log.Printf("Certificates: %d", certificatesCount)
	log.Printf("Projects: %d", projectsCount)
	log.Printf("Contacts: %d", contactsCount)
	log.Printf("Social Links: %d", socialLinksCount)
	log.Printf("Photos: %d", photosCount)

	return nil
}
