package services

import (
	"fmt"
	"log"

	"portfolio-os/internal/models"

	"gorm.io/gorm"
)

func MigrateDatabase(db *gorm.DB) error {
	log.Println("Running database migrations...")

	err := db.AutoMigrate(
		&models.Profile{},
		&models.Statistic{},
		&models.Skill{},
		&models.ServiceOffering{},
		&models.EducationEntry{},
		&models.Certificate{},
		&models.Project{},
		&models.ContactInfo{},
		&models.SocialLink{},
		&models.Photo{},
	)

	if err != nil {
		return fmt.Errorf("database migration failed: %w", err)
	}

	log.Println("Database migrations completed successfully")

	return nil
}
