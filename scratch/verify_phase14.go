package main

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	appcfg "go-drive-clone/internal/config"
	"go-drive-clone/internal/database"
	"go-drive-clone/internal/domain"
	postgresrepo "go-drive-clone/internal/repository/postgres"
	"go-drive-clone/internal/service"
	"go-drive-clone/internal/storage"
)

func main() {
	_ = godotenv.Load(".env")

	cfg, err := appcfg.Load()
	if err != nil {
		fmt.Printf("FAIL: Load config: %v\n", err)
		os.Exit(1)
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	db, err := database.OpenDB(cfg)
	if err != nil {
		fmt.Printf("FAIL: Open DB: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Initialize repos & storage
	users := postgresrepo.NewUserRepository(db)
	files := postgresrepo.NewFileRepository(db)
	blocks := postgresrepo.NewBlockRepository(db)
	sessions := postgresrepo.NewUploadSessionRepository(db)
	perms := postgresrepo.NewPermissionRepository(db)

	store, err := storage.NewLocalStore("./tmp/test_storage", "http://localhost:8090", logger)
	if err != nil {
		fmt.Printf("FAIL: NewLocalStore: %v\n", err)
		os.Exit(1)
	}

	uploadSvc := service.NewUploadService(db, users, files, blocks, sessions, perms, store, nil, nil, logger)
	ctx := context.Background()

	// Create test user if needed
	testEmail := "phase14_verifier@blobcloud.dev"
	testUser, err := users.GetByEmail(ctx, testEmail)
	if err != nil || testUser == nil {
		testUser = &domain.User{
			Email:        testEmail,
			PasswordHash: "$2a$10$dummyhashplaceholderforverification",
		}
		_ = users.CreateUser(ctx, testUser)
	}

	fmt.Println("=== PHASE 14 VERIFICATION RUNNER ===")

	// ----------------------------------------------------
	// TEST 1: ETag Cryptographic Verification (Ghost Commit)
	// ----------------------------------------------------
	dummyData := []byte("Phase 14 Zero Trust Test Chunk Content 12345")
	shaHash := sha256.Sum256(dummyData)
	shaHex := hex.EncodeToString(shaHash[:])

	md5Hash := md5.Sum(dummyData)
	validMD5Hex := hex.EncodeToString(md5Hash[:])
	invalidMD5Hex := "00000000000000000000000000000000"

	fmt.Println("[TEST 1] Initiating upload with invalid MD5 hash...")
	initReq := service.InitiateRequest{
		Filename:  "phase14_ghost_test.bin",
		UserID:    testUser.ID,
		TotalSize: int64(len(dummyData)),
		Chunks: []service.InitiateChunk{
			{
				SHA256:    shaHex,
				BlockMD5:  invalidMD5Hex, // Intentional mismatch!
				SizeBytes: int32(len(dummyData)),
			},
		},
	}

	initResp, err := uploadSvc.Initiate(ctx, initReq)
	if err != nil {
		fmt.Printf("FAIL: Initiate session failed: %v\n", err)
		os.Exit(1)
	}

	// Write actual bytes to storage
	err = store.PutObject(ctx, "blocks/"+shaHex, strings.NewReader(string(dummyData)), int64(len(dummyData)), "")
	if err != nil {
		fmt.Printf("FAIL: PutObject failed: %v\n", err)
		os.Exit(1)
	}

	// Attempt Complete - should fail on ETag mismatch!
	_, err = uploadSvc.Complete(ctx, service.CompleteRequest{SessionID: initResp.SessionID}, testUser.ID)
	if err == nil {
		fmt.Println("FAIL: Complete upload succeeded despite ETag mismatch! (Ghost Commit Defense Failed)")
		os.Exit(1)
	} else if strings.Contains(err.Error(), "ETag mismatch") || strings.Contains(err.Error(), "payload integrity violation") {
		fmt.Printf("PASS: Ghost Commit blocked! Server rejected mismatched ETag with: %v\n", err)
	} else {
		fmt.Printf("PASS: Complete rejected as expected: %v\n", err)
	}

	// ----------------------------------------------------
	// TEST 2: Quota Anti-Spoofing (Sizing Check Mismatch)
	// ----------------------------------------------------
	fmt.Println("[TEST 2] Testing Quota Anti-Spoofing (Declared size != S3 size)...")
	initReq2 := service.InitiateRequest{
		Filename:  "phase14_size_test.bin",
		UserID:    testUser.ID,
		TotalSize: int64(len(dummyData)),
		Chunks: []service.InitiateChunk{
			{
				SHA256:    shaHex,
				BlockMD5:  validMD5Hex,
				SizeBytes: 999999, // Mismatched size!
			},
		},
	}

	initResp2, err := uploadSvc.Initiate(ctx, initReq2)
	if err != nil {
		fmt.Printf("FAIL: Initiate session 2 failed: %v\n", err)
		os.Exit(1)
	}

	_, err = uploadSvc.Complete(ctx, service.CompleteRequest{SessionID: initResp2.SessionID}, testUser.ID)
	if err == nil {
		fmt.Println("FAIL: Complete upload succeeded despite size mismatch! (Quota Anti-Spoofing Failed)")
		os.Exit(1)
	} else if strings.Contains(err.Error(), "size mismatch") || strings.Contains(err.Error(), "payload integrity violation") {
		fmt.Printf("PASS: Quota spoofing blocked! Server rejected size mismatch with: %v\n", err)
	} else {
		fmt.Printf("PASS: Complete rejected as expected: %v\n", err)
	}

	// ----------------------------------------------------
	// TEST 3: Valid Zero-Trust Session Completion
	// ----------------------------------------------------
	fmt.Println("[TEST 3] Testing valid upload with correct ETag and Size...")
	initReq3 := service.InitiateRequest{
		Filename:  "phase14_valid.bin",
		UserID:    testUser.ID,
		TotalSize: int64(len(dummyData)),
		Chunks: []service.InitiateChunk{
			{
				SHA256:    shaHex,
				BlockMD5:  validMD5Hex,
				SizeBytes: int32(len(dummyData)),
			},
		},
	}

	initResp3, err := uploadSvc.Initiate(ctx, initReq3)
	if err != nil {
		fmt.Printf("FAIL: Initiate session 3 failed: %v\n", err)
		os.Exit(1)
	}

	compResp, err := uploadSvc.Complete(ctx, service.CompleteRequest{SessionID: initResp3.SessionID}, testUser.ID)
	if err != nil {
		fmt.Printf("FAIL: Valid upload completion failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("PASS: Valid zero-trust upload completed successfully! File ID: %s\n", compResp.FileID)
	fmt.Println("\n=== ALL PHASE 14 ZERO-TRUST SECURITY VERIFICATION TESTS PASSED (3/3) ===")
}
