package services

import (
	"errors"
	"fmt"
	"sync"

	"portfolio-os/internal/models"

	"gorm.io/gorm"
)

type PortfolioService struct {
	mu sync.RWMutex
	db *gorm.DB
}

func NewPortfolioService(db *gorm.DB) *PortfolioService {
	return &PortfolioService{
		db: db,
	}
}

func (s *PortfolioService) GetPortfolio() models.Portfolio {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var portfolio models.Portfolio

	s.db.First(&portfolio.Profile)

	s.db.Order("id ASC").Find(&portfolio.Statistics)
	s.db.Order("id ASC").Find(&portfolio.Skills)
	s.db.Order("id ASC").Find(&portfolio.Services)
	s.db.Order("id ASC").Find(&portfolio.Education)
	s.db.Order("id ASC").Find(&portfolio.Certificates)
	s.db.Order("id ASC").Find(&portfolio.Projects)
	s.db.First(&portfolio.Contact)
	s.db.Order("id ASC").Find(&portfolio.SocialLinks)
	s.db.Order("display_order ASC, id ASC").Find(&portfolio.Photos)

	// If no custom photos are in database, default to bundled slideshow photos
	if len(portfolio.Photos) == 0 {
		portfolio.Photos = models.DefaultPhotos()
	}

	return portfolio
}

// Profile

func (s *PortfolioService) UpdateProfile(profile models.Profile) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var existing models.Profile

	err := s.db.First(&existing).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.db.Create(&profile).Error
	}

	if err != nil {
		return err
	}

	profile.ID = existing.ID

	return s.db.Save(&profile).Error
}

// Photos (Slideshow)

func (s *PortfolioService) AddPhoto(photo models.Photo) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Create(&photo).Error
}

func (s *PortfolioService) UpdatePhoto(index int, photo models.Photo) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getPhotoID(index)
	if err != nil {
		return err
	}

	photo.ID = id

	return s.db.Save(&photo).Error
}

func (s *PortfolioService) DeletePhoto(index int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getPhotoID(index)
	if err != nil {
		return err
	}

	return s.db.Delete(&models.Photo{}, id).Error
}

// Certificates

func (s *PortfolioService) AddCertificate(certificate models.Certificate) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Create(&certificate).Error
}

func (s *PortfolioService) UpdateCertificate(index int, certificate models.Certificate) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getCertificateID(index)
	if err != nil {
		return err
	}

	certificate.ID = id

	return s.db.Save(&certificate).Error
}

func (s *PortfolioService) DeleteCertificate(index int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getCertificateID(index)
	if err != nil {
		return err
	}

	return s.db.Delete(&models.Certificate{}, id).Error
}

// Skills

func (s *PortfolioService) AddSkill(skill models.Skill) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Create(&skill).Error
}

func (s *PortfolioService) UpdateSkill(index int, skill models.Skill) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getSkillID(index)
	if err != nil {
		return err
	}

	skill.ID = id

	return s.db.Save(&skill).Error
}

func (s *PortfolioService) DeleteSkill(index int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getSkillID(index)
	if err != nil {
		return err
	}

	return s.db.Delete(&models.Skill{}, id).Error
}

// Statistics

func (s *PortfolioService) AddStatistic(statistic models.Statistic) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Create(&statistic).Error
}

func (s *PortfolioService) UpdateStatistic(index int, statistic models.Statistic) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getStatisticID(index)
	if err != nil {
		return err
	}

	statistic.ID = id

	return s.db.Save(&statistic).Error
}

func (s *PortfolioService) DeleteStatistic(index int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getStatisticID(index)
	if err != nil {
		return err
	}

	return s.db.Delete(&models.Statistic{}, id).Error
}

// Services

func (s *PortfolioService) AddService(service models.ServiceOffering) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Create(&service).Error
}

func (s *PortfolioService) UpdateService(index int, service models.ServiceOffering) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getServiceID(index)
	if err != nil {
		return err
	}

	service.ID = id

	return s.db.Save(&service).Error
}

func (s *PortfolioService) DeleteService(index int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getServiceID(index)
	if err != nil {
		return err
	}

	return s.db.Delete(&models.ServiceOffering{}, id).Error
}

// Education

func (s *PortfolioService) AddEducation(education models.EducationEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Create(&education).Error
}

func (s *PortfolioService) UpdateEducation(index int, education models.EducationEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getEducationID(index)
	if err != nil {
		return err
	}

	education.ID = id

	return s.db.Save(&education).Error
}

func (s *PortfolioService) DeleteEducation(index int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getEducationID(index)
	if err != nil {
		return err
	}

	return s.db.Delete(&models.EducationEntry{}, id).Error
}

// Projects

func (s *PortfolioService) AddProject(project models.Project) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Create(&project).Error
}

func (s *PortfolioService) UpdateProject(index int, project models.Project) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getProjectID(index)
	if err != nil {
		return err
	}

	project.ID = id

	return s.db.Save(&project).Error
}

func (s *PortfolioService) DeleteProject(index int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getProjectID(index)
	if err != nil {
		return err
	}

	return s.db.Delete(&models.Project{}, id).Error
}

// Contact

func (s *PortfolioService) UpdateContact(contact models.ContactInfo) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var existing models.ContactInfo

	err := s.db.First(&existing).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.db.Create(&contact).Error
	}

	if err != nil {
		return err
	}

	contact.ID = existing.ID

	return s.db.Save(&contact).Error
}

// Social Links

func (s *PortfolioService) AddSocialLink(link models.SocialLink) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Create(&link).Error
}

func (s *PortfolioService) UpdateSocialLink(index int, link models.SocialLink) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getSocialLinkID(index)
	if err != nil {
		return err
	}

	link.ID = id

	return s.db.Save(&link).Error
}

func (s *PortfolioService) DeleteSocialLink(index int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := s.getSocialLinkID(index)
	if err != nil {
		return err
	}

	return s.db.Delete(&models.SocialLink{}, id).Error
}

// IsImageReferenced checks if an image URL is actively referenced by any database entity.
func (s *PortfolioService) IsImageReferenced(imageURL string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if imageURL == "" {
		return false
	}

	var count int64
	s.db.Model(&models.Project{}).Where("image = ?", imageURL).Count(&count)
	if count > 0 {
		return true
	}
	s.db.Model(&models.Certificate{}).Where("image = ?", imageURL).Count(&count)
	if count > 0 {
		return true
	}
	s.db.Model(&models.Profile{}).Where("profile_image = ?", imageURL).Count(&count)
	if count > 0 {
		return true
	}
	s.db.Model(&models.Photo{}).Where("url = ?", imageURL).Count(&count)
	if count > 0 {
		return true
	}

	return false
}

// ID lookup helpers

func (s *PortfolioService) getPhotoID(index int) (uint, error) {
	var records []models.Photo
	if err := s.db.Order("display_order ASC, id ASC").Find(&records).Error; err != nil {
		return 0, err
	}
	if index < 0 || index >= len(records) {
		return 0, fmt.Errorf("photo index out of range")
	}
	return records[index].ID, nil
}

func (s *PortfolioService) getCertificateID(index int) (uint, error) {
	var records []models.Certificate

	if err := s.db.Order("id ASC").Find(&records).Error; err != nil {
		return 0, err
	}

	if index < 0 || index >= len(records) {
		return 0, fmt.Errorf("certificate index out of range")
	}

	return records[index].ID, nil
}

func (s *PortfolioService) getSkillID(index int) (uint, error) {
	var records []models.Skill

	if err := s.db.Order("id ASC").Find(&records).Error; err != nil {
		return 0, err
	}

	if index < 0 || index >= len(records) {
		return 0, fmt.Errorf("skill index out of range")
	}

	return records[index].ID, nil
}

func (s *PortfolioService) getStatisticID(index int) (uint, error) {
	var records []models.Statistic

	if err := s.db.Order("id ASC").Find(&records).Error; err != nil {
		return 0, err
	}

	if index < 0 || index >= len(records) {
		return 0, fmt.Errorf("statistic index out of range")
	}

	return records[index].ID, nil
}

func (s *PortfolioService) getServiceID(index int) (uint, error) {
	var records []models.ServiceOffering

	if err := s.db.Order("id ASC").Find(&records).Error; err != nil {
		return 0, err
	}

	if index < 0 || index >= len(records) {
		return 0, fmt.Errorf("service index out of range")
	}

	return records[index].ID, nil
}

func (s *PortfolioService) getEducationID(index int) (uint, error) {
	var records []models.EducationEntry

	if err := s.db.Order("id ASC").Find(&records).Error; err != nil {
		return 0, err
	}

	if index < 0 || index >= len(records) {
		return 0, fmt.Errorf("education index out of range")
	}

	return records[index].ID, nil
}

func (s *PortfolioService) getProjectID(index int) (uint, error) {
	var records []models.Project

	if err := s.db.Order("id ASC").Find(&records).Error; err != nil {
		return 0, err
	}

	if index < 0 || index >= len(records) {
		return 0, fmt.Errorf("project index out of range")
	}

	return records[index].ID, nil
}

func (s *PortfolioService) getSocialLinkID(index int) (uint, error) {
	var records []models.SocialLink

	if err := s.db.Order("id ASC").Find(&records).Error; err != nil {
		return 0, err
	}

	if index < 0 || index >= len(records) {
		return 0, fmt.Errorf("social link index out of range")
	}

	return records[index].ID, nil
}
