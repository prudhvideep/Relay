package main

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	Conns map[*websocket.Conn]bool
}

func NewServer() *Server {
	return &Server{
		Conns: make(map[*websocket.Conn]bool),
	}
}

func GetClientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		ips := strings.Split(forwarded, ",")
		return strings.TrimSpace(ips[0])
	}

	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

func (s *Server) ReadLoop(conn *websocket.Conn) {
	for {
		_, data, err := conn.ReadMessage()

		if err != nil {
			log.Println("Conn closed ", err.Error())
			delete(s.Conns, conn)
			return
		}

		log.Printf("Remote addr %s\n", conn.RemoteAddr())
		log.Printf("Received - %s\n", string(data))
	}
}

func (s *Server) HandlePeerJoin(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Println("Error upgrading the connection ", err.Error())
		return
	}

	if _, exists := s.Conns[conn]; exists {
		return
	}

	log.Println("Client ip", GetClientIP(r))

	s.Conns[conn] = true

	go s.ReadLoop(conn)
}

func (s *Server) HandlePeerConns(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var peers []string

	for k := range s.Conns {
		peers = append(peers, k.RemoteAddr().String())
	}

	log.Println(peers)

	if err := json.NewEncoder(w).Encode(peers); err != nil {
     log.Println(err)
	}
}

func main() {
	s := NewServer() 
	http.HandleFunc("/ws", s.HandlePeerJoin)   
	http.HandleFunc("/conns", s.HandlePeerConns)

	log.Fatal(http.ListenAndServe("localhost:6969", nil))
}
