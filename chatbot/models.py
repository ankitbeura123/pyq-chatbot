from django.db import models

class Subject(models.Model):
    name = models.CharField(max_length=100)
    semester = models.CharField(max_length=20)

    class Meta:
        unique_together = ('name', 'semester')

    def __str__(self):
        return f"{self.semester} - {self.name}"


class Document(models.Model):
    DOC_TYPES = [
        ('pyq', 'Previous Year Question'),
        ('syllabus', 'Syllabus'),
    ]

    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=10, choices=DOC_TYPES)
    file_name = models.CharField(max_length=255)
    exam_type = models.CharField(max_length=30, blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    source_path = models.CharField(max_length=500)
    ingested_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file_name


class ChatMessage(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"